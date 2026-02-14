/**
 * OAuth configuration.
 * GITHUB_CLIENT_ID is public and safe for client-side.
 * The client_secret lives only in the token exchange proxy.
 */
export const OAUTH_CONFIG = {
  clientId: import.meta.env.PUBLIC_GITHUB_CLIENT_ID ?? '',
  // The proxy that exchanges code → token (keeps client_secret server-side)
  tokenProxyUrl: import.meta.env.PUBLIC_OAUTH_PROXY_URL ?? '',
  // Where GitHub redirects after authorization
  redirectUri: import.meta.env.PUBLIC_OAUTH_REDIRECT_URI ?? '',
  // Scopes needed: read user profile for identity
  scopes: 'read:user',
};

/** Build the GitHub OAuth authorize URL */
export function getAuthorizeUrl(): string {
  const params = new URLSearchParams({
    client_id: OAUTH_CONFIG.clientId,
    redirect_uri: OAUTH_CONFIG.redirectUri,
    scope: OAUTH_CONFIG.scopes,
  });
  return `https://github.com/login/oauth/authorize?${params}`;
}

/** Exchange an authorization code for an access token via the proxy */
export async function exchangeCodeForToken(code: string): Promise<string> {
  const res = await fetch(OAUTH_CONFIG.tokenProxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });

  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status}`);
  }

  const data = await res.json();
  return data.access_token;
}

/** Fetch the authenticated user's profile */
export async function fetchUser(token: string): Promise<{ login: string; avatarUrl: string }> {
  const res = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch user: ${res.status}`);
  }

  const data = await res.json();
  return {
    login: data.login,
    avatarUrl: data.avatar_url,
  };
}
