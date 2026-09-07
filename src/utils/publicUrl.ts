/**
 * Prefix Vite `base` for root-relative public assets (`/icons/…`, `/audio/…`).
 * Leaves absolute http(s) URLs unchanged.
 */
export function publicUrl(path: string): string {
  if (!path || /^https?:\/\//i.test(path)) return path;
  const base = import.meta.env?.BASE_URL || '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  return `${normalizedBase}${normalizedPath}`;
}
