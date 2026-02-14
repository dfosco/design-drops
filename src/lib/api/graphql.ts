const GITHUB_GRAPHQL_ENDPOINT = 'https://api.github.com/graphql';
const MAX_RETRIES = 3;

export class GraphQLError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GraphQLError';
  }
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: { message: string }[];
}

/**
 * Thin typed fetch wrapper for the GitHub GraphQL API.
 * Handles rate limiting with exponential backoff (max 3 retries).
 */
export async function graphql<T>(
  query: string,
  variables: Record<string, unknown>,
  token: string,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(GITHUB_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    // Handle rate limiting
    const remaining = res.headers.get('X-RateLimit-Remaining');
    if (remaining === '0' && attempt < MAX_RETRIES) {
      const resetHeader = res.headers.get('X-RateLimit-Reset');
      const resetMs = resetHeader
        ? Number(resetHeader) * 1000 - Date.now()
        : 0;
      const backoff = Math.max(resetMs, 1000 * 2 ** attempt);
      await new Promise((r) => setTimeout(r, backoff));
      continue;
    }

    const body: GraphQLResponse<T> = await res.json();

    if (body.errors?.length) {
      const msg = body.errors[0].message;
      if (attempt < MAX_RETRIES) {
        lastError = new GraphQLError(msg);
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
        continue;
      }
      throw new GraphQLError(msg);
    }

    if (!res.ok) {
      const msg = `GitHub API responded with ${res.status}`;
      if (attempt < MAX_RETRIES) {
        lastError = new GraphQLError(msg);
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
        continue;
      }
      throw new GraphQLError(msg);
    }

    return body.data as T;
  }

  throw lastError ?? new GraphQLError('Max retries exceeded');
}
