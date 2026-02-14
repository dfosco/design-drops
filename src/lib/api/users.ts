import { config } from '../config';

export interface GitHubUser {
  login: string;
  avatar_url: string;
}

/** Fetch collaborators for the configured repo */
export async function fetchRepoCollaborators(token: string): Promise<string[]> {
  const url = `https://api.github.com/repos/${config.repo.owner}/${config.repo.name}/collaborators?per_page=100`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    // If user doesn't have permission to list collaborators, fall back to contributors
    if (res.status === 403) {
      return fetchRepoContributors(token);
    }
    return [];
  }

  const data: GitHubUser[] = await res.json();
  return data.map(u => u.login);
}

/** Fallback: fetch contributors (public API, no special permissions needed) */
async function fetchRepoContributors(token: string): Promise<string[]> {
  const url = `https://api.github.com/repos/${config.repo.owner}/${config.repo.name}/contributors?per_page=100`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return [];
  const data: GitHubUser[] = await res.json();
  return data.map(u => u.login);
}

/** Search GitHub users by partial login */
export async function searchGitHubUsers(token: string, query: string): Promise<string[]> {
  if (!query || query.length < 2) return [];
  const url = `https://api.github.com/search/users?q=${encodeURIComponent(query)}+in:login&per_page=8`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items ?? []).map((u: GitHubUser) => u.login);
}
