import type { Element, Root as HastRoot } from 'hast';
import path from 'node:path';
import { visit } from 'unist-util-visit';

export interface LinkContext {
  /** Project-relative path of the document being rendered. */
  docPath: string;
  docId: string;
  /** Project-relative path → document id, or null if the file is not published. */
  resolveDoc: (relPath: string) => string | null;
}

const SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;

export function docHref(docId: string, anchor?: string | null): string {
  return anchor ? `#/d/${docId}?h=${encodeURIComponent(anchor)}` : `#/d/${docId}`;
}

function resolveRelative(docPath: string, target: string): string {
  const base = target.startsWith('/') ? '' : path.posix.dirname(docPath);
  return path.posix.normalize(path.posix.join(base, target.replace(/^\/+/, '')));
}

/**
 * Rewrites links so they work inside the hash-routed viewer:
 * - `#frag` → same document, `?h=frag`
 * - relative paths to published docs → `#/d/<docId>`
 * - relative paths to anything else → non-clickable `<span data-unpublished>`
 * - external links → open in a new tab
 */
export function rehypeSpecKitLinks(ctx: LinkContext) {
  return (tree: HastRoot) => {
    visit(tree, 'element', (node: Element, index, parent) => {
      if (node.tagName !== 'a') return;
      const href = typeof node.properties.href === 'string' ? node.properties.href : null;
      if (!href) return;
      if (SCHEME_RE.test(href) || href.startsWith('//')) {
        node.properties.target = '_blank';
        node.properties.rel = ['noopener', 'noreferrer'];
        return;
      }
      if (href.startsWith('#')) {
        node.properties.href = docHref(ctx.docId, decodeURIComponentSafe(href.slice(1)));
        return;
      }
      const [rawPath, frag] = splitOnce(href, '#');
      const rel = resolveRelative(ctx.docPath, decodeURIComponentSafe(rawPath.split('?')[0]));
      const target = rel.startsWith('..') ? null : ctx.resolveDoc(rel);
      if (target) {
        node.properties.href = docHref(target, frag ? decodeURIComponentSafe(frag) : null);
        return;
      }
      if (parent && typeof index === 'number') {
        parent.children[index] = {
          type: 'element',
          tagName: 'span',
          properties: { className: ['unpublished-link'], dataUnpublished: rel },
          children: node.children,
        };
      }
    });
  };
}

function splitOnce(s: string, sep: string): [string, string | null] {
  const i = s.indexOf(sep);
  return i < 0 ? [s, null] : [s.slice(0, i), s.slice(i + 1)];
}

function decodeURIComponentSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
