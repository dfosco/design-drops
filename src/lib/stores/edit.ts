import { writable } from 'svelte/store';
import type { Post } from '../types/post';

/** When set, PostComposer opens in edit mode with this post's data */
export const editingPost = writable<Post | null>(null);
