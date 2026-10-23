import { useHashLocation } from 'wouter/use-hash-location';

export interface Route {
  /** Path inside the hash, e.g. `/d/abc123`. */
  path: string;
  segments: string[];
  query: URLSearchParams;
}

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '') || '/';
  const [p, q = ''] = raw.split('?', 2);
  const path = p.startsWith('/') ? p : `/${p}`;
  return {
    path,
    segments: path
      .split('/')
      .filter(Boolean)
      .map((s) => {
        try {
          return decodeURIComponent(s);
        } catch {
          return s;
        }
      }),
    query: new URLSearchParams(q),
  };
}

export function href(path: string, query?: Record<string, string | null | undefined>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) if (v) params.set(k, v);
  const qs = params.toString();
  return `#${path}${qs ? `?${qs}` : ''}`;
}

export function navigate(
  path: string,
  query?: Record<string, string | null | undefined>,
  replace = false,
): void {
  const target = href(path, query);
  if (replace) history.replaceState(null, '', target);
  else location.hash = target;
  if (replace) window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export function useRoute(): Route {
  const [hash] = useHashLocation();
  return parseHash(hash);
}

export const featureHref = (id: string) => href(`/f/${encodeURIComponent(id)}`);
export const docHref = (id: string, anchor?: string | null) => href(`/d/${id}`, { h: anchor });
