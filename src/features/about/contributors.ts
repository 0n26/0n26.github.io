const REPOSITORY = '0n26/0n26.github.io';
export const REPOSITORY_URL = `https://github.com/${REPOSITORY}`;
// shortcut: load the first page, paginate if the repository reaches 100 contributors.
const CONTRIBUTORS_URL = `https://api.github.com/repos/${REPOSITORY}/contributors?per_page=100`;

type Contributor = {
  login: string;
  avatar_url: string;
  contributions: number;
};

function isContributor(item: unknown): item is Contributor {
  if (typeof item !== 'object' || item === null) return false;
  const { type, login, avatar_url, contributions } = item as Record<string, unknown>;
  return type === 'User' &&
    typeof login === 'string' && /^[a-z\d-]{1,39}$/i.test(login) &&
    typeof avatar_url === 'string' && avatar_url.startsWith('https://avatars.githubusercontent.com/') &&
    typeof contributions === 'number' && Number.isSafeInteger(contributions) && contributions >= 0;
}

export async function loadContributors(signal: AbortSignal): Promise<Contributor[]> {
  const response = await fetch(CONTRIBUTORS_URL, {
    headers: { Accept: 'application/vnd.github+json' },
    signal,
  });
  if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
  if (response.status === 204) return [];
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new Error('Invalid contributor list');
  return data.filter(isContributor);
}
