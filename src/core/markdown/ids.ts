import type { ListItem, Root } from 'mdast';
import { visit } from 'unist-util-visit';
import { nodeText } from './ast.ts';

// Spec Kit identifiers: FR-001, SC-001, T001, CHK001.
export const ID_PATTERN = /\b(FR-\d{3,}|SC-\d{3,}|CHK\d{3,}|T\d{3,})\b/;
export const ID_PATTERN_GLOBAL = new RegExp(ID_PATTERN.source, 'g');
const LEADING_ID = /^\s*(FR-\d{3,}|SC-\d{3,}|CHK\d{3,}|T\d{3,})\b/;

export function anchorForId(id: string): string {
  return id.toLowerCase();
}

/** The identifier a list item *defines* (e.g. `- [ ] T001 …`, `- **FR-001**: …`), if any. */
export function definedIdOf(item: ListItem): string | null {
  const first = item.children[0];
  if (!first) return null;
  return LEADING_ID.exec(nodeText(first))?.[1] ?? null;
}

/**
 * Give definition list items a stable `id` (via hProperties, survives mdast → hast)
 * and return the id → anchor map. First definition wins; duplicates get no id.
 */
export function assignDefinitionAnchors(root: Root): Record<string, string> {
  const anchors: Record<string, string> = {};
  visit(root, 'listItem', (item) => {
    const id = definedIdOf(item);
    if (!id || anchors[id]) return;
    const anchor = anchorForId(id);
    anchors[id] = anchor;
    item.data = { ...item.data, hProperties: { ...(item.data?.hProperties ?? {}), id: anchor } };
  });
  return anchors;
}
