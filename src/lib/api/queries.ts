import { graphql } from './graphql';
import { parseMetadata, extractBodyText } from '../metadata';
import { slugify } from '../slug';
import { config } from '../config';
import type { Post } from '../types/post';

// --- GraphQL query strings ---

export const GET_DISCUSSIONS = `
  query GetDiscussions($owner: String!, $name: String!, $categoryId: ID!, $first: Int!) {
    repository(owner: $owner, name: $name) {
      discussions(
        categoryId: $categoryId
        first: $first
        orderBy: { field: CREATED_AT, direction: DESC }
        states: [OPEN]
      ) {
        nodes {
          id
          number
          title
          body
          createdAt
          comments {
            totalCount
          }
          author {
            login
            avatarUrl
          }
        }
      }
    }
  }
`;

export const GET_DISCUSSION_BY_ID = `
  query GetDiscussionById($id: ID!) {
    node(id: $id) {
      ... on Discussion {
        id
        number
        title
        body
        createdAt
        reactionGroups {
          content
          users { totalCount }
          viewerHasReacted
        }
        comments(first: 50) {
          totalCount
          nodes {
            id
            body
            createdAt
            author {
              login
              avatarUrl
            }
            reactionGroups {
              content
              users { totalCount }
              viewerHasReacted
            }
            replies(first: 20) {
              nodes {
                id
                body
                createdAt
                author {
                  login
                  avatarUrl
                }
                reactionGroups {
                  content
                  users { totalCount }
                  viewerHasReacted
                }
              }
            }
          }
        }
        author {
          login
          avatarUrl
        }
      }
    }
  }
`;

export const FIND_DISCUSSION_BY_LOCAL_ID = `
  query FindDiscussionByLocalId($query: String!) {
    search(query: $query, type: DISCUSSION, first: 5) {
      nodes {
        ... on Discussion {
          id
          number
          body
        }
      }
    }
  }
`;

export const GET_DISCUSSIONS_WITH_COMMENTS = `
  query GetDiscussionsWithComments($owner: String!, $name: String!, $categoryId: ID!, $first: Int!) {
    repository(owner: $owner, name: $name) {
      discussions(
        categoryId: $categoryId
        first: $first
        orderBy: { field: CREATED_AT, direction: DESC }
        states: [OPEN]
      ) {
        nodes {
          id
          number
          title
          body
          createdAt
          comments(first: 50) {
            nodes {
              id
              body
              createdAt
              author { login avatarUrl }
              replies(first: 20) {
                nodes {
                  id
                  body
                  createdAt
                  author { login avatarUrl }
                }
              }
            }
          }
          author { login avatarUrl }
        }
      }
    }
  }
`;

// --- Response types ---

interface ReactionGroupNode {
  content: string;
  users: { totalCount: number };
  viewerHasReacted: boolean;
}

interface DiscussionNode {
  id: string;
  number: number;
  title: string;
  body: string;
  createdAt: string;
  reactionGroups?: ReactionGroupNode[];
  comments: {
    totalCount: number;
    nodes?: {
      id: string;
      body: string;
      createdAt: string;
      author: { login: string; avatarUrl: string };
      reactionGroups?: ReactionGroupNode[];
      replies?: {
        nodes: {
          id: string;
          body: string;
          createdAt: string;
          author: { login: string; avatarUrl: string };
          reactionGroups?: ReactionGroupNode[];
        }[];
      };
    }[];
  };
  author: { login: string; avatarUrl: string };
}

interface GetDiscussionsResponse {
  repository: {
    discussions: {
      nodes: DiscussionNode[];
    };
  };
}

interface GetDiscussionByIdResponse {
  node: DiscussionNode;
}

interface FindDiscussionByLocalIdResponse {
  search: {
    nodes: { id: string; number: number; body: string }[];
  };
}

interface GetDiscussionByNumberResponse {
  repository: {
    discussion: DiscussionNode | null;
  };
}

const GET_DISCUSSION_BY_NUMBER = `
  query GetDiscussionByNumber($owner: String!, $name: String!, $number: Int!) {
    repository(owner: $owner, name: $name) {
      discussion(number: $number) {
        id
        number
        title
        body
        createdAt
        author { login avatarUrl }
        comments(first: 50) {
          totalCount
          nodes {
            id
            body
            createdAt
            author {
              login
              avatarUrl
            }
            replies(first: 20) {
              nodes {
                id
                body
                createdAt
                author {
                  login
                  avatarUrl
                }
              }
            }
          }
        }
      }
    }
  }
`;

/** Build the canonical URL path for a post. */
export function postUrl(post: Post): string {
  const slug = slugify(post.metadata.title);
  return `${config.site.basePath}/post/${post.number}/${slug}`;
}

// --- Repo metadata ---

const GET_REPO_IDS = `
  query GetRepoIds($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      id
      discussionCategories(first: 25) {
        nodes { id name }
      }
    }
  }
`;

interface RepoIdsResponse {
  repository: {
    id: string;
    discussionCategories: {
      nodes: { id: string; name: string }[];
    };
  };
}

/** Fetch repositoryId and categoryId for a given category name */
export async function fetchRepoIds(
  token: string,
  repoOwner: string,
  repoName: string,
  categoryName: string,
): Promise<{ repositoryId: string; categoryId: string }> {
  const data = await graphql<RepoIdsResponse>(
    GET_REPO_IDS,
    { owner: repoOwner, name: repoName },
    token,
  );

  const category = data.repository.discussionCategories.nodes.find(
    (c) => c.name === categoryName,
  );

  if (!category) {
    throw new Error(
      `Discussion category "${categoryName}" not found. A repo admin must create it at https://github.com/${repoOwner}/${repoName}/discussions/categories`
    );
  }

  return {
    repositoryId: data.repository.id,
    categoryId: category.id,
  };
}

// --- Helper functions ---

export async function fetchPosts(
  token: string,
  repoOwner: string,
  repoName: string,
  categoryId: string,
  first: number = 25,
): Promise<Post[]> {
  const data = await graphql<GetDiscussionsResponse>(
    GET_DISCUSSIONS,
    { owner: repoOwner, name: repoName, categoryId, first },
    token,
  );

  const posts: Post[] = [];
  for (const node of data.repository.discussions.nodes) {
    const metadata = parseMetadata(node.body);
    if (!metadata) continue;
    posts.push({
      id: node.id,
      number: node.number,
      metadata,
      body: extractBodyText(node.body),
      createdAt: node.createdAt,
      commentCount: node.comments.totalCount,
    });
  }
  return posts;
}

export async function fetchUserComments(
  token: string,
  repoOwner: string,
  repoName: string,
  categoryId: string,
  username: string,
  first: number = 100,
): Promise<import('../types/post').UserComment[]> {
  const data = await graphql<GetDiscussionsResponse>(
    GET_DISCUSSIONS_WITH_COMMENTS,
    { owner: repoOwner, name: repoName, categoryId, first },
    token,
  );

  const comments: import('../types/post').UserComment[] = [];

  for (const node of data.repository.discussions.nodes) {
    const metadata = parseMetadata(node.body);
    if (!metadata) continue;
    const postTitle = metadata.title;
    const postNumber = node.number;
    const postSlug = slugify(metadata.title);

    for (const c of node.comments.nodes ?? []) {
      if (c.author?.login === username) {
        comments.push({
          id: c.id,
          body: c.body,
          createdAt: c.createdAt,
          postTitle,
          postNumber,
          postSlug,
          isReply: false,
        });
      }
      for (const r of c.replies?.nodes ?? []) {
        if (r.author?.login === username) {
          comments.push({
            id: r.id,
            body: r.body,
            createdAt: r.createdAt,
            postTitle,
            postNumber,
            postSlug,
            isReply: true,
          });
        }
      }
    }
  }

  comments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return comments;
}

export async function fetchPost(
  token: string,
  discussionId: string,
): Promise<Post | null> {
  const data = await graphql<GetDiscussionByIdResponse>(
    GET_DISCUSSION_BY_ID,
    { id: discussionId },
    token,
  );

  if (!data.node) return null;
  const metadata = parseMetadata(data.node.body);
  if (!metadata) return null;

  return {
    id: data.node.id,
    number: data.node.number,
    metadata,
    body: extractBodyText(data.node.body),
    createdAt: data.node.createdAt,
    commentCount: data.node.comments.totalCount,
    reactions: data.node.reactionGroups?.filter((r) => r.users.totalCount > 0).map((r) => ({ content: r.content, totalCount: r.users.totalCount, viewerHasReacted: r.viewerHasReacted })) ?? [],
    comments: (data.node.comments.nodes ?? []).map((c) => ({
      id: c.id,
      body: c.body,
      author: c.author,
      createdAt: c.createdAt,
      reactions: c.reactionGroups?.filter((r) => r.users.totalCount > 0).map((r) => ({ content: r.content, totalCount: r.users.totalCount, viewerHasReacted: r.viewerHasReacted })) ?? [],
      replies: (c.replies?.nodes ?? []).map((r) => ({
        id: r.id,
        body: r.body,
        author: r.author,
        createdAt: r.createdAt,
        reactions: r.reactionGroups?.filter((rg) => rg.users.totalCount > 0).map((rg) => ({ content: rg.content, totalCount: rg.users.totalCount, viewerHasReacted: rg.viewerHasReacted })) ?? [],
      })),
    })),
  };
}

/** Find a post by matching its title slug against all discussions, then fetch full details. */
export async function fetchPostBySlug(
  token: string,
  repoOwner: string,
  repoName: string,
  categoryId: string,
  slug: string,
): Promise<Post | null> {
  const posts = await fetchPosts(token, repoOwner, repoName, categoryId);
  const match = posts.find((p) => slugify(p.metadata.title) === slug);
  if (!match) return null;
  return fetchPost(token, match.id);
}

export async function fetchPostByNumber(
  token: string,
  repoOwner: string,
  repoName: string,
  number: number,
): Promise<Post | null> {
  const data = await graphql<GetDiscussionByNumberResponse>(
    GET_DISCUSSION_BY_NUMBER,
    { owner: repoOwner, name: repoName, number },
    token,
  );

  const disc = data.repository?.discussion;
  if (!disc) return null;
  const metadata = parseMetadata(disc.body);
  if (!metadata) return null;

  return {
    id: disc.id,
    number: disc.number,
    metadata,
    body: extractBodyText(disc.body),
    createdAt: disc.createdAt,
    commentCount: disc.comments.totalCount,
    comments: (disc.comments.nodes ?? []).map((c) => ({
      id: c.id,
      body: c.body,
      author: c.author,
      createdAt: c.createdAt,
      replies: (c.replies?.nodes ?? []).map((r) => ({
        id: r.id,
        body: r.body,
        author: r.author,
        createdAt: r.createdAt,
      })),
    })),
  };
}

export async function findDiscussionByLocalID(
  token: string,
  repoOwner: string,
  repoName: string,
  localID: string,
): Promise<string | null> {
  const query = `repo:${repoOwner}/${repoName} ${localID}`;
  const data = await graphql<FindDiscussionByLocalIdResponse>(
    FIND_DISCUSSION_BY_LOCAL_ID,
    { query },
    token,
  );

  for (const node of data.search.nodes) {
    if (node.body?.includes(localID)) {
      return node.id;
    }
  }
  return null;
}
