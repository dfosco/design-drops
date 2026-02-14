import type { Post, OptimisticEntry } from './types/post';
import { clearEntry } from './stores/local';

export function reconcileFeed(
  apiPosts: Post[],
  localEntries: OptimisticEntry[],
): Post[] {
  const apiIDs = new Set(apiPosts.map((p) => p.id));

  // Step 1: Remove orphaned synced entries
  for (const entry of localEntries) {
    if (entry.status === 'synced' && entry.discussionID && !apiIDs.has(entry.discussionID)) {
      clearEntry(entry.localID);
    }
  }

  // Step 2: Deduplicate — collect discussionIDs that are already in API results
  const syncedAPISet = new Set(
    localEntries
      .filter((e) => e.status === 'synced' && e.discussionID && apiIDs.has(e.discussionID))
      .map((e) => e.localID),
  );

  // Step 3: Merge — keep local-only entries (pending/syncing/failed without a matching API post)
  const localOnly = localEntries.filter((e) => !syncedAPISet.has(e.localID) && !(e.status === 'synced'));

  // Step 4: Convert local-only entries to Post shape
  const localPosts: Post[] = localOnly.map((entry) => ({
    id: entry.localID,
    metadata: entry.data.metadata,
    body: entry.data.body,
    createdAt: entry.data.createdAt,
    commentCount: 0,
    optimisticStatus: entry.status,
  }));

  const merged = [...apiPosts, ...localPosts];

  // Step 5: Sort by createdAt desc (newest first)
  merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return merged;
}
