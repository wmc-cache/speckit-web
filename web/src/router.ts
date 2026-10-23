import { useEffect, useState } from 'react';

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
      .map((s) => decodeURIComponent(s)),
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
  const [route, setRoute] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const on = () => setRoute(parseHash(location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export const featureHref = (id: string) => href(`/f/${encodeURIComponent(id)}`);
export const docHref = (id: string, anchor?: string | null) => href(`/d/${id}`, { h: anchor });
