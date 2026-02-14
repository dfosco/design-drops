/**
 * PAT-based auth — users generate a Personal Access Token and paste it.
 * No OAuth, no proxy, no secrets. Just GitHub API (which supports CORS).
 */

/** Pre-filled URL for creating a PAT with the right scopes */
export function getTokenCreationUrl(): string {
  return 'https://github.com/settings/tokens/new?description=Design+Drops&scopes=repo,read:user';
}

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
  return {
    login: data.login,
    avatarUrl: data.avatar_url,
  };
}
