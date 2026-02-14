import { graphql } from './graphql';
import { parseMetadata, extractBodyText } from '../metadata';
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
        title
        body
        createdAt
        comments(first: 50) {
          totalCount
          nodes {
            id
            body
            author {
              login
              avatarUrl
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
          body
        }
      }
    }
  }
`;

// --- Response types ---

interface DiscussionNode {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  comments: { totalCount: number; nodes?: { id: string; body: string; author: { login: string; avatarUrl: string } }[] };
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
    nodes: { id: string; body: string }[];
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
      metadata,
      body: extractBodyText(node.body),
      createdAt: node.createdAt,
      commentCount: node.comments.totalCount,
    });
  }
  return posts;
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
    metadata,
    body: extractBodyText(data.node.body),
    createdAt: data.node.createdAt,
    commentCount: data.node.comments.totalCount,
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
