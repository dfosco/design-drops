import { graphql } from './graphql';
import { serializeMetadata } from '../metadata';
import { config } from '../config';
import type { PostMetadata } from '../types/post';

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

// --- Image upload via Contents API ---

async function uploadImage(
  token: string,
  filename: string,
  base64Content: string,
): Promise<string> {
  const raw = base64Content.replace(/^data:[^;]+;base64,/, '');
  const path = `uploads/images/${filename}`;
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
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Image upload failed: ${res.status} ${(err as any).message ?? ''}`);
  }

  return `https://raw.githubusercontent.com/${config.repo.owner}/${config.repo.name}/main/${path}`;
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

// --- Public API ---

/** Create a new post: upload images → create Discussion */
export async function createPost(token: string, payload: CreatePostPayload): Promise<string> {
  let meta = payload.metadata;

  if (payload.pendingImages?.length) {
    meta = await uploadPendingImages(token, meta, payload.pendingImages);
  }

  const fullBody = serializeMetadata(meta, payload.body);

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

  const fullBody = serializeMetadata(meta, payload.body);

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
