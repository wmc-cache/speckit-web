import type { Element, ElementContent, Root as HastRoot, Text } from 'hast';
import { visit, SKIP } from 'unist-util-visit';
import type { ClarificationMark } from '../model.ts';
import { CLARIFICATION_MARKER } from '../parse/spec-summary.ts';

/** Wraps `[NEEDS CLARIFICATION…]` markers (outside code) in `<mark class="needs-clarification" id="nc-N">`. */
export function rehypeClarificationMarks(out: ClarificationMark[]) {
  return () => (tree: HastRoot) => {
    visit(tree, (node, index, parent) => {
      if (node.type === 'element' && (node.tagName === 'code' || node.tagName === 'pre')) return SKIP;
      if (node.type !== 'text' || !parent || typeof index !== 'number') return;
      const value = (node as Text).value;
      if (!value.includes(CLARIFICATION_MARKER)) return;
      const pieces: ElementContent[] = [];
      let from = 0;
      for (;;) {
        const i = value.indexOf(CLARIFICATION_MARKER, from);
        if (i < 0) break;
        const close = value.indexOf(']', i);
        const end = close < 0 ? value.length : close + 1;
        if (i > from) pieces.push({ type: 'text', value: value.slice(from, i) });
        const text = value.slice(i, end);
        const anchor = `nc-${out.length + 1}`;
        out.push({ anchor, text: text.replace(/^\[NEEDS CLARIFICATION\s*:?\s*|\]$/g, '').trim() });
        const mark: Element = {
          type: 'element',
          tagName: 'mark',
          properties: { className: ['needs-clarification'], id: anchor },
          children: [{ type: 'text', value: text }],
        };
        pieces.push(mark);
        from = end;
      }
      if (from < value.length) pieces.push({ type: 'text', value: value.slice(from) });
      parent.children.splice(index, 1, ...pieces);
      return [SKIP, index + pieces.length];
    });
  };
}
