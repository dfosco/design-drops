import { config } from '../config';

/**
 * Cache of blob URLs keyed by the original raw URL.
 * Prevents redundant fetches for the same image across re-renders.
 */
const blobCache = new Map<string, string>();
const inflightRequests = new Map<string, Promise<string>>();

/**
 * Parses a raw.githubusercontent.com URL into its API-equivalent path components.
 * Expected format: https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}
 */
function parseRawUrl(rawUrl: string): { path: string; ref: string } | null {
  const prefix = `https://raw.githubusercontent.com/${config.repo.owner}/${config.repo.name}/`;
  if (!rawUrl.startsWith(prefix)) return null;

  const rest = rawUrl.slice(prefix.length);
  const slashIdx = rest.indexOf('/');
  if (slashIdx < 0) return null;

  return {
    ref: rest.slice(0, slashIdx),
    path: rest.slice(slashIdx + 1),
  };
}

/**
 * Fetches a private-repo image via the GitHub Contents API and returns a blob URL.
 * Results are cached so repeated calls with the same URL return instantly.
 */
export async function fetchAuthImage(rawUrl: string, token: string): Promise<string> {
  // Return cached blob URL if available
  const cached = blobCache.get(rawUrl);
  if (cached) return cached;

  // Deduplicate in-flight requests for the same URL
  const inflight = inflightRequests.get(rawUrl);
  if (inflight) return inflight;

  const parsed = parseRawUrl(rawUrl);
  if (!parsed) return rawUrl; // not a raw.githubusercontent URL, pass through

  const promise = (async () => {
    const apiUrl = `https://api.github.com/repos/${config.repo.owner}/${config.repo.name}/contents/${parsed.path}?ref=${parsed.ref}`;

    const res = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.raw+json',
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch image: ${res.status}`);
    }

    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    blobCache.set(rawUrl, blobUrl);
    return blobUrl;
  })();

  inflightRequests.set(rawUrl, promise);

  try {
    return await promise;
  } finally {
    inflightRequests.delete(rawUrl);
  }
}
