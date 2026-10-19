/** Nopetion's instance-wide restrictions; document authorization stays upstream. */
export function isPersonalModeRestrictedPath(rawUrl: string): boolean {
  let path: string;
  try {
    path = decodeURIComponent(rawUrl.split('?')[0]).replace(/\/{2,}/g, '/');
    path = new URL(path, 'http://localhost').pathname;
  } catch {
    // Fail closed on malformed URL encoding.
    return true;
  }
  // Normalize dot segments in the same way clients/proxies normalize URLs.
  const prefixes = [
    '/share',
    '/docs',
    '/api/shares',
    '/api/public-spaces',
    '/api/search/share-search',
    '/api/search/public-space-search',
    '/api/files/public',
    '/api/pages/watch',
    '/api/pages/unwatch',
    '/api/pages/watch-status',
    '/api/spaces/watch',
    '/api/spaces/unwatch',
    '/api/spaces/watch-status',
    '/api/spaces/watched-ids',
    '/api/workspace/invites',
    '/api/workspace/create',
    '/api/auth/register',
    '/api/auth/signup',
    '/api/sso',
    '/api/scim',
    '/scim',
  ];
  return prefixes.some((prefix) => path === prefix || path.startsWith(prefix + '/'));
}
