/**
 * OAuth configuration — uses GitHub's PKCE flow (no client_secret needed).
 * Token exchange goes through a tiny CORS proxy since GitHub's endpoint blocks browsers.
 */
export const OAUTH_CONFIG = {
  clientId: import.meta.env.PUBLIC_GITHUB_CLIENT_ID ?? '',
  redirectUri: import.meta.env.PUBLIC_OAUTH_REDIRECT_URI ?? '',
  tokenProxyUrl: import.meta.env.PUBLIC_OAUTH_PROXY_URL ?? '',
  scopes: 'read:user',
};

// --- PKCE helpers ---

/** Generate a cryptographically random code_verifier (43–128 chars) */
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

/** SHA-256 hash the verifier and base64url-encode it */
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const VERIFIER_KEY = 'dd-pkce-verifier';

/** Build the GitHub OAuth authorize URL with PKCE challenge */
export async function getAuthorizeUrl(): Promise<string> {
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);

  // Store verifier for the callback to use
  sessionStorage.setItem(VERIFIER_KEY, verifier);

  const params = new URLSearchParams({
    client_id: OAUTH_CONFIG.clientId,
    redirect_uri: OAUTH_CONFIG.redirectUri,
    scope: OAUTH_CONFIG.scopes,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  return `https://github.com/login/oauth/authorize?${params}`;
}

/** Exchange an authorization code for an access token via CORS proxy */
export async function exchangeCodeForToken(code: string): Promise<string> {
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  if (!verifier) {
    throw new Error('Missing PKCE code_verifier — did you start the auth flow in this browser?');
  }

  const res = await fetch(OAUTH_CONFIG.tokenProxyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: OAUTH_CONFIG.clientId,
      code,
      redirect_uri: OAUTH_CONFIG.redirectUri,
      code_verifier: verifier,
    }),
  });

  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status}`);
  }

  const data = await res.json();

  if (data.error) {
    throw new Error(data.error_description ?? data.error);
  }

  // Clean up verifier
  sessionStorage.removeItem(VERIFIER_KEY);

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
