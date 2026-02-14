import { writable } from 'svelte/store';
import localstory from 'localstory';
import type { Post, OptimisticStatus, OptimisticEntry } from '../types/post';

const NAMESPACE = 'dd-posts';

let store: ReturnType<typeof localstory> | null = null;

function getStore() {
  if (store) return store;
  if (typeof window === 'undefined') return null;
  store = localstory(window.localStorage, NAMESPACE);
  return store;
}

function hydrateEntries(): OptimisticEntry[] {
  const s = getStore();
  if (!s) return [];
  const keys: string[] = s.keys();
  const entries: OptimisticEntry[] = [];
  for (const key of keys) {
    const val = s.get(key);
    if (val && typeof val === 'object' && 'localID' in val) {
      entries.push(val as OptimisticEntry);
    }
  }
  return entries;
}

const { subscribe, set, update } = writable<OptimisticEntry[]>(hydrateEntries());

export function addEntry(post: Post, base64Previews?: string[]): void {
  const s = getStore();
  const entry: OptimisticEntry = {
    localID: post.metadata.localID,
    status: 'pending',
    data: base64Previews
      ? {
          ...post,
          metadata: {
            ...post.metadata,
            assets: post.metadata.assets.map((asset, i) => ({
              ...asset,
              url: base64Previews[i] ?? asset.url,
            })),
          },
        }
      : post,
    createdAt: new Date().toISOString(),
  };
  s?.set(entry.localID, entry);
  update((entries) => [...entries, entry]);
}

export function updateStatus(
  localID: string,
  status: OptimisticStatus,
  discussionID?: string,
): void {
  const s = getStore();
  update((entries) => {
    return entries.map((e) => {
      if (e.localID !== localID) return e;
      const updated: OptimisticEntry = {
        ...e,
        status,
        ...(discussionID !== undefined ? { discussionID } : {}),
      };
      s?.set(localID, updated);
      return updated;
    });
  });
}

export function getEntry(localID: string): OptimisticEntry | null {
  const s = getStore();
  if (!s) return null;
  return (s.get(localID) as OptimisticEntry) ?? null;
}

export function clearEntry(localID: string): void {
  const s = getStore();
  s?.unset(localID);
  update((entries) => entries.filter((e) => e.localID !== localID));
}

export function getAllEntries(): OptimisticEntry[] {
  const s = getStore();
  if (!s) return [];
  const keys: string[] = s.keys();
  return keys
    .map((k) => s.get(k) as OptimisticEntry)
    .filter((v): v is OptimisticEntry => v != null && typeof v === 'object' && 'localID' in v);
}

export function replaceWithCanonical(
  localID: string,
  canonicalPost: Post,
  discussionID: string,
): void {
  const s = getStore();
  update((entries) => {
    return entries.map((e) => {
      if (e.localID !== localID) return e;
      const updated: OptimisticEntry = {
        ...e,
        status: 'synced',
        data: canonicalPost,
        discussionID,
      };
      s?.set(localID, updated);
      return updated;
    });
  });
}

export const optimisticEntries = { subscribe };
