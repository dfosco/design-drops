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

export type ReactionContent = 'THUMBS_UP' | 'THUMBS_DOWN' | 'LAUGH' | 'HOORAY' | 'CONFUSED' | 'HEART' | 'ROCKET' | 'EYES';

export interface ReactionGroup {
  content: ReactionContent;
  totalCount: number;
  viewerHasReacted: boolean;
}

export interface Comment {
  id: string;
  body: string;
  author: User;
  createdAt: string;
  replies?: Comment[];
  reactions?: ReactionGroup[];
}

/** A comment with context about which post it belongs to */
export interface UserComment {
  id: string;
  body: string;
  createdAt: string;
  postTitle: string;
  postNumber: number;
  postSlug: string;
  isReply: boolean;
}

export interface Post {
  id: string;
  number: number;
  metadata: PostMetadata;
  body: string;
  createdAt: string;
  commentCount: number;
  comments?: Comment[];
  reactions?: ReactionGroup[];
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
