import { findDiscussionByLocalID } from './api/queries';
import { dispatchWorkflow } from './api/dispatch';
import { updateStatus, getEntry, clearEntry, getAllEntries } from './stores/local';

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
    // Check if Discussion exists with this localID
    const discussionId = await findDiscussionByLocalID(token, repoOwner, repoName, localID);

    if (discussionId) {
      const entry = getEntry(localID);
      if (entry?.status === 'pendingDeletion') {
        await dispatchWorkflow({
          action: 'delete',
          localID,
          discussionId,
        });
        clearEntry(localID);
      } else {
        updateStatus(localID, 'synced', discussionId);
      }
      return;
    }

    // Check for error file
    try {
      const errorUrl = `https://raw.githubusercontent.com/${repoOwner}/${repoName}/main/uploads/${localID}.error`;
      const res = await fetch(errorUrl, { method: 'HEAD' });
      if (res.ok) {
        updateStatus(localID, 'failed');
        return;
      }
    } catch {
      // Network error checking error file — continue polling
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  // Timeout reached
  updateStatus(localID, 'failed');
}

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
