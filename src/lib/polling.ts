import { findDiscussionByLocalID } from './api/queries';
import { deletePost } from './api/dispatch';
import { updateStatus, getEntry, clearEntry, getAllEntries } from './stores/local';

/**
 * Poll for a Discussion matching a localID.
 * Used when optimistic entries need confirmation (e.g. after network retry).
 */
export async function pollForConfirmation(
  localID: string,
  token: string,
  repoOwner: string,
  repoName: string,
  timeoutMs: number = 30000,
): Promise<void> {
  const interval = 3000;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const discussionId = await findDiscussionByLocalID(token, repoOwner, repoName, localID);

    if (discussionId) {
      const entry = getEntry(localID);
      if (entry?.status === 'pendingDeletion') {
        await deletePost(token, discussionId);
        clearEntry(localID);
      } else {
        updateStatus(localID, 'synced', discussionId);
      }
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  updateStatus(localID, 'failed');
}

/** Resume polling for any entries left in pending/syncing state */
export function resumePendingPolls(
  token: string,
  repoOwner: string,
  repoName: string,
): void {
  const entries = getAllEntries();
  for (const entry of entries) {
    if (entry.status === 'pending' || entry.status === 'syncing') {
      pollForConfirmation(entry.localID, token, repoOwner, repoName);
    }
  }
}
