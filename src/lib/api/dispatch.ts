import { graphql } from './graphql';
import { serializeMetadata } from '../metadata';
import { config } from '../config';
import { slugify } from '../slug';
import type { PostMetadata, ReactionGroup } from '../types/post';

/** Convert [[project-name]] mentions to markdown links before sending to GitHub. */
function convertProjectMentions(text: string): string {
  return text.replace(/\[\[([^\]]+)\]\]/g, (_, projectName: string) => {
    const slug = slugify(projectName);
    const url = `${config.site.siteUrl}${config.site.basePath}/project/${slug}`;
    return `[${projectName}](${url})`;
  });
}

export interface PendingImage {
  id: string;
  filename: string;
  base64: string; // data URI: "data:image/png;base64,..."
}

export interface CreatePostPayload {
  title: string;
  body: string;
  metadata: PostMetadata;
  repositoryId: string;
  categoryId: string;
  pendingImages?: PendingImage[];
}

export interface EditPostPayload {
  discussionId: string;
  body: string;
  metadata: PostMetadata;
  pendingImages?: PendingImage[];
}

// --- Image upload via Contents API (media branch) ---

const MEDIA_BRANCH = 'media';

async function uploadImage(
  token: string,
  filename: string,
  base64Content: string,
): Promise<string> {
  const raw = base64Content.replace(/^data:[^;]+;base64,/, '');
  const path = `images/${filename}`;
  const url = `https://api.github.com/repos/${config.repo.owner}/${config.repo.name}/contents/${path}`;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: `upload: ${filename}`,
      content: raw,
      branch: MEDIA_BRANCH,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Image upload failed: ${res.status} ${(err as any).message ?? ''}`);
  }

  return `https://raw.githubusercontent.com/${config.repo.owner}/${config.repo.name}/${MEDIA_BRANCH}/${path}`;
}

async function uploadPendingImages(
  token: string,
  metadata: PostMetadata,
  pendingImages: PendingImage[],
): Promise<PostMetadata> {
  const updatedAssets = [...metadata.assets];

  for (const img of pendingImages) {
    const cdnUrl = await uploadImage(token, img.filename, img.base64);
    const assetIndex = updatedAssets.findIndex((a) => a.id === img.id);
    if (assetIndex >= 0) {
      updatedAssets[assetIndex] = { ...updatedAssets[assetIndex], url: cdnUrl, pendingCDN: false };
    }
  }

  return { ...metadata, assets: updatedAssets };
}

// --- GraphQL mutations ---

const CREATE_DISCUSSION = `
  mutation CreateDiscussion($input: CreateDiscussionInput!) {
    createDiscussion(input: $input) {
      discussion { id url }
    }
  }
`;

const UPDATE_DISCUSSION = `
  mutation UpdateDiscussion($input: UpdateDiscussionInput!) {
    updateDiscussion(input: $input) {
      discussion { id }
    }
  }
`;

const CLOSE_DISCUSSION = `
  mutation CloseDiscussion($id: ID!, $reason: DiscussionCloseReason!) {
    closeDiscussion(input: { discussionId: $id, reason: $reason }) {
      discussion { id }
    }
  }
`;

const ADD_DISCUSSION_COMMENT = `
  mutation AddDiscussionComment($discussionId: ID!, $body: String!) {
    addDiscussionComment(input: { discussionId: $discussionId, body: $body }) {
      comment { id }
    }
  }
`;

const REPLY_TO_DISCUSSION_COMMENT = `
  mutation ReplyToDiscussionComment($discussionId: ID!, $replyToId: ID!, $body: String!) {
    addDiscussionComment(input: { discussionId: $discussionId, replyToId: $replyToId, body: $body }) {
      comment { id }
    }
  }
`;

const DELETE_DISCUSSION_COMMENT = `
  mutation DeleteDiscussionComment($id: ID!) {
    deleteDiscussionComment(input: { id: $id }) {
      comment { id }
    }
  }
`;

// --- Public API ---

/** Create a new post: upload images → create Discussion */
export async function createPost(token: string, payload: CreatePostPayload): Promise<string> {
  let meta = payload.metadata;

  if (payload.pendingImages?.length) {
    meta = await uploadPendingImages(token, meta, payload.pendingImages);
  }

  const convertedBody = convertProjectMentions(payload.body);
  const fullBody = serializeMetadata(meta, convertedBody);

  const data = await graphql<{ createDiscussion: { discussion: { id: string; url: string } } }>(
    CREATE_DISCUSSION,
    {
      input: {
        repositoryId: payload.repositoryId,
        categoryId: payload.categoryId,
        title: payload.title,
        body: fullBody,
      },
    },
    token,
  );

  return data.createDiscussion.discussion.id;
}

/** Edit an existing post: upload new images → update Discussion */
export async function editPost(token: string, payload: EditPostPayload): Promise<void> {
  let meta = payload.metadata;

  if (payload.pendingImages?.length) {
    meta = await uploadPendingImages(token, meta, payload.pendingImages);
  }

  const convertedBody = convertProjectMentions(payload.body);
  const fullBody = serializeMetadata(meta, convertedBody);

  await graphql(
    UPDATE_DISCUSSION,
    { input: { discussionId: payload.discussionId, body: fullBody } },
    token,
  );
}

/** Delete a post by closing the Discussion */
export async function deletePost(token: string, discussionId: string): Promise<void> {
  await graphql(
    CLOSE_DISCUSSION,
    { id: discussionId, reason: 'OUTDATED' },
    token,
  );
}

/** Add a comment to a Discussion */
export async function addComment(token: string, discussionId: string, body: string): Promise<string> {
  const convertedBody = convertProjectMentions(body);
  const data = await graphql<{ addDiscussionComment: { comment: { id: string } } }>(
    ADD_DISCUSSION_COMMENT,
    { discussionId, body: convertedBody },
    token,
  );
  return data.addDiscussionComment.comment.id;
}

/** Reply to a comment on a Discussion */
export async function replyToComment(token: string, discussionId: string, replyToId: string, body: string): Promise<string> {
  const convertedBody = convertProjectMentions(body);
  const data = await graphql<{ addDiscussionComment: { comment: { id: string } } }>(
    REPLY_TO_DISCUSSION_COMMENT,
    { discussionId, replyToId, body: convertedBody },
    token,
  );
  return data.addDiscussionComment.comment.id;
}

/** Delete a comment from a Discussion */
export async function deleteComment(token: string, commentId: string): Promise<void> {
  await graphql(
    DELETE_DISCUSSION_COMMENT,
    { id: commentId },
    token,
  );
}

// --- Reaction mutations ---

const ADD_REACTION = `
  mutation AddReaction($subjectId: ID!, $content: ReactionContent!) {
    addReaction(input: { subjectId: $subjectId, content: $content }) {
      reaction { content }
      subject {
        ... on DiscussionComment {
          reactionGroups {
            content
            users { totalCount }
            viewerHasReacted
          }
        }
        ... on Discussion {
          reactionGroups {
            content
            users { totalCount }
            viewerHasReacted
          }
        }
      }
    }
  }
`;

const REMOVE_REACTION = `
  mutation RemoveReaction($subjectId: ID!, $content: ReactionContent!) {
    removeReaction(input: { subjectId: $subjectId, content: $content }) {
      reaction { content }
      subject {
        ... on DiscussionComment {
          reactionGroups {
            content
            users { totalCount }
            viewerHasReacted
          }
        }
        ... on Discussion {
          reactionGroups {
            content
            users { totalCount }
            viewerHasReacted
          }
        }
      }
    }
  }
`;

interface MutationReactionGroup {
  content: string;
  users: { totalCount: number };
  viewerHasReacted: boolean;
}

function normalizeReactionGroups(groups: MutationReactionGroup[]): ReactionGroup[] {
  return groups
    .map((g) => ({ content: g.content as ReactionGroup['content'], totalCount: g.users.totalCount, viewerHasReacted: g.viewerHasReacted }))
    .filter((r) => r.totalCount > 0);
}

/** Add a reaction to a Discussion or DiscussionComment */
export async function addReaction(token: string, subjectId: string, content: string): Promise<ReactionGroup[]> {
  const data = await graphql<{ addReaction: { subject: { reactionGroups: MutationReactionGroup[] } } }>(
    ADD_REACTION,
    { subjectId, content },
    token,
  );
  return normalizeReactionGroups(data.addReaction?.subject?.reactionGroups ?? []);
}

/** Remove a reaction from a Discussion or DiscussionComment */
export async function removeReaction(token: string, subjectId: string, content: string): Promise<ReactionGroup[]> {
  const data = await graphql<{ removeReaction: { subject: { reactionGroups: MutationReactionGroup[] } } }>(
    REMOVE_REACTION,
    { subjectId, content },
    token,
  );
  return normalizeReactionGroups(data.removeReaction?.subject?.reactionGroups ?? []);
}
