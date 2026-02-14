export interface Asset {
  id: string;
  type: 'image';
  url: string;
  pendingCDN: boolean;
}

export interface CommentPin {
  commentLocalID: string;
  imageID: string;
  x: number;
  y: number;
}

export interface PostMetadata {
  localID: string;
  versionID: string;
  authors: string[];
  collaborators: string[];
  title: string;
  tags: string[];
  team: string;
  project: string;
  urls: string[];
  assets: Asset[];
  commentPins: CommentPin[];
}

export interface Comment {
  id: string;
  body: string;
  author: User;
  createdAt: string;
  replies?: Comment[];
}

export interface Post {
  id: string;
  metadata: PostMetadata;
  body: string;
  createdAt: string;
  commentCount: number;
  comments?: Comment[];
  optimisticStatus?: OptimisticStatus;
}

export type OptimisticStatus =
  | 'pending'
  | 'syncing'
  | 'synced'
  | 'pendingDeletion'
  | 'pendingEdit'
  | 'failed';

export interface OptimisticEntry {
  localID: string;
  status: OptimisticStatus;
  data: Post;
  discussionID?: string;
  createdAt: string;
}

export interface User {
  login: string;
  avatarUrl: string;
}
