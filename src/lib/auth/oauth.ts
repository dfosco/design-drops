/**
 * PAT-based auth — users generate a Personal Access Token and paste it.
 * No OAuth, no proxy, no secrets. Just GitHub API (which supports CORS).
 */

import { config } from '../config';

/** Fetch the user's verified emails from GitHub */
async function fetchUserEmails(token: string): Promise<string[]> {
  const res = await fetch('https://api.github.com/user/emails', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const emails: { email: string; verified: boolean; primary: boolean }[] = await res.json();
  return emails.filter(e => e.verified).map(e => e.email);
}

/** Check if any email matches the access control config */
function isEmailAllowed(emails: string[]): boolean {
  const { allowedDomains, allowedEmails } = config.access;

  // No restrictions configured — allow everyone
  if ((!allowedDomains || allowedDomains.length === 0) &&
      (!allowedEmails || allowedEmails.length === 0)) {
    return true;
  }

  for (const email of emails) {
    const lower = email.toLowerCase();

    // Check exact email match
    if (allowedEmails?.some(allowed => allowed.toLowerCase() === lower)) {
      return true;
    }

    // Check domain match
    const domain = lower.split('@')[1];
    if (domain && allowedDomains?.some(d => d.toLowerCase() === domain)) {
      return true;
    }
  }

  return false;
}

/** Pre-filled URL for creating a PAT with the right scopes */
export function getTokenCreationUrl(): string {
  const device = typeof navigator !== 'undefined' && /Mobi|Android/i.test(navigator.userAgent)
    ? 'Mobile browser'
    : 'Desktop browser';
  const description = encodeURIComponent(`Design Drops - ${device}`);
  return `https://github.com/settings/tokens/new?description=${description}&scopes=repo,read:user`;
}

/** Instructions for token expiration (can't be pre-filled via URL) */
export const TOKEN_EXPIRATION_HINT = 'Set expiration to "No expiration" or a long period (90 days+) to avoid frequent re-authentication.';

/** Validate a PAT and fetch the user's profile */
export async function validateToken(token: string): Promise<{ login: string; avatarUrl: string }> {
  const res = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401) {
    throw new Error('Invalid token. Please check and try again.');
  }

  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status}`);
  }

  const data = await res.json();

  // Check email-based access control
  const hasRestrictions = (config.access?.allowedDomains?.length > 0) ||
                          (config.access?.allowedEmails?.length > 0);
  if (hasRestrictions) {
    const emails = await fetchUserEmails(token);
    if (!isEmailAllowed(emails)) {
      const domains = config.access.allowedDomains;
      const hint = domains.length > 0
        ? `Only users with a verified ${domains.join(' or ')} email can access this app.`
        : 'Your email is not on the authorized list.';
      throw new Error(`Access denied. ${hint}`);
    }
  }

  return {
    login: data.login,
    avatarUrl: data.avatar_url,
  };
}
