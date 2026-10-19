/** Browser-facing mount point. Stored document links and API routes stay relative to the app. */
export function appBasePath(): string {
  return (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
}

export function appPath(path: string): string {
  if (!path.startsWith('/') || path.startsWith('//')) return path;
  const base = appBasePath();
  if (base && (path === base || path.startsWith(base + '/') || path.startsWith(base + '?') || path.startsWith(base + '#'))) return path;
  return base + path;
}

export function stripAppPath(path: string): string {
  const base = appBasePath();
  if (base && path === base) return '/';
  return base && path.startsWith(base + '/') ? path.slice(base.length) : path;
}

/** Recognize copied links at this installation without treating other origins as internal. */
export function logicalLink(url: string): string {
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.origin !== window.location.origin) return url;
    return stripAppPath(parsed.pathname) + parsed.search + parsed.hash;
  } catch { return url; }
}
