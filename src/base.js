export function resolveBase(env = {}) {
  if (env.BASE_PATH !== undefined) {
    const path = env.BASE_PATH.trim();
    if (!path || path === '/') return '/';
    if (!/^\/?[a-zA-Z0-9._/-]+\/?$/.test(path) || path.includes('..')) throw new Error('BASE_PATH must be a local path such as /portfolio/');
    return `/${path.replace(/^\/+|\/+$/g, '')}/`;
  }
  const [owner, repo] = (env.GITHUB_REPOSITORY || '').split('/');
  if (!repo || repo.toLowerCase() === `${owner}.github.io`.toLowerCase()) return '/';
  return `/${repo}/`;
}
