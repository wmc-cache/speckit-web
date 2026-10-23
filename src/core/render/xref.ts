import type { Element, ElementContent, Root as HastRoot, Text } from 'hast';
import { SKIP } from 'unist-util-visit';
import { visitParents } from 'unist-util-visit-parents';
import { ID_PATTERN_GLOBAL } from '../markdown/ids.ts';

const SKIP_TAGS = new Set(['code', 'pre', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'mark']);

/**
 * Turns `FR-###`, `SC-###`, `T###`, `CHK###` mentions into links to their definitions.
 * `resolve` returns an href or null for unknown ids; a definition's own text is never linked.
 */
export function rehypeXref(resolve: (id: string) => { href: string; anchor: string; self: boolean } | null) {
  return () => (tree: HastRoot) => {
    visitParents(tree, 'text', (node: Text, ancestors) => {
      const parent = ancestors[ancestors.length - 1] as Element | HastRoot;
      if (ancestors.some((a) => a.type === 'element' && SKIP_TAGS.has((a as Element).tagName))) return;
      const value = node.value;
      ID_PATTERN_GLOBAL.lastIndex = 0;
      if (!ID_PATTERN_GLOBAL.test(value)) return;
      ID_PATTERN_GLOBAL.lastIndex = 0;
      const pieces: ElementContent[] = [];
      let last = 0;
      let linked = false;
      for (const m of value.matchAll(ID_PATTERN_GLOBAL)) {
        const target = resolve(m[1]);
        if (!target) continue;
        // Inside the defining list item → leave the id as plain text.
        const inDefinition =
          target.self &&
          ancestors.some((a) => a.type === 'element' && (a as Element).properties?.id === target.anchor);
        if (inDefinition) continue;
        if (m.index! > last) pieces.push({ type: 'text', value: value.slice(last, m.index) });
        pieces.push({
          type: 'element',
          tagName: 'a',
          properties: { className: ['xref'], href: target.href },
          children: [{ type: 'text', value: m[1] }],
        });
        last = m.index! + m[1].length;
        linked = true;
      }
      if (!linked) return;
      if (last < value.length) pieces.push({ type: 'text', value: value.slice(last) });
      const idx = parent.children.indexOf(node);
      parent.children.splice(idx, 1, ...pieces);
      return SKIP;
    });
  };
}
