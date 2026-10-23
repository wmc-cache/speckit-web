// Search matching shared by the local server and the static-site Web Worker: no Node APIs here.
import type { SearchHit, SearchIndexEntry, SearchResult } from './model.ts';

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 200;
const CONTEXT = 40;

/** Lower-case + full-width → half-width, one code unit at a time so offsets stay aligned with the original. */
export function normalize(s: string): string {
  let out = '';
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    let c = ch;
    if (code === 0x3000) c = ' ';
    else if (code >= 0xff01 && code <= 0xff5e) c = String.fromCharCode(code - 0xfee0);
    const lower = c.toLowerCase();
    out += lower.length === c.length ? lower : c;
  }
  return out;
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!,
  );
}

const normCache = new WeakMap<SearchIndexEntry, { title: string; text: string }>();
function normalized(e: SearchIndexEntry) {
  let n = normCache.get(e);
  if (!n) {
    n = { title: normalize(e.title), text: normalize(e.text) };
    normCache.set(e, n);
  }
  return n;
}

function countOccurrences(hay: string, needle: string, cap = 10): number {
  let n = 0;
  for (let i = hay.indexOf(needle); i >= 0 && n < cap; i = hay.indexOf(needle, i + needle.length)) n++;
  return n;
}

function snippet(text: string, at: number, len: number): string {
  if (at < 0)
    return escapeHtml(
      text
        .slice(0, CONTEXT * 2)
        .replace(/\s+/g, ' ')
        .trim(),
    );
  const start = Math.max(0, at - CONTEXT);
  const end = Math.min(text.length, at + len + CONTEXT);
  const clean = (s: string) => escapeHtml(s.replace(/\s+/g, ' '));
  return `${start > 0 ? '…' : ''}${clean(text.slice(start, at))}<mark>${clean(text.slice(at, at + len))}</mark>${clean(
    text.slice(at + len, end),
  )}${end < text.length ? '…' : ''}`;
}

/** Case-insensitive substring search; title hits rank above body hits, ties keep feature order. */
export function searchEntries(
  entries: SearchIndexEntry[],
  query: string,
  limit = DEFAULT_LIMIT,
): SearchResult {
  const q = normalize(query.trim());
  const max = Math.min(Math.max(1, limit), MAX_LIMIT);
  if (!q) return { query, hits: [], total: 0 };
  const found: { hit: SearchHit; order: number }[] = [];
  for (const e of entries) {
    const n = normalized(e);
    const inTitle = n.title.includes(q);
    const at = n.text.indexOf(q);
    if (!inTitle && at < 0) continue;
    const score = (inTitle ? 100 : 0) + (at >= 0 ? countOccurrences(n.text, q) : 0);
    let anchor: string | null = null;
    if (at >= 0) for (const h of e.headings) if (h.offset <= at) anchor = h.anchor;
    found.push({
      hit: {
        docId: e.docId,
        featureId: e.featureId,
        title: e.title,
        path: e.path,
        anchor,
        snippet: snippet(e.text, at, q.length),
        score,
      },
      order: e.featureOrder,
    });
  }
  found.sort((a, b) => b.hit.score - a.hit.score || a.order - b.order || (a.hit.path < b.hit.path ? -1 : 1));
  return { query, total: found.length, hits: found.slice(0, max).map((f) => f.hit) };
}
