import GithubSlugger from 'github-slugger';
import type { Heading as MdHeading, ListItem, Root, RootContent } from 'mdast';
import { toString } from 'mdast-util-to-string';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import type { Heading } from '../model.ts';

const parser = unified().use(remarkParse).use(remarkGfm);

export function parseMarkdown(text: string): Root {
  return parser.runSync(parser.parse(text)) as Root;
}

export function nodeText(node: RootContent | Root): string {
  return toString(node);
}

export function createSlugger() {
  const slugger = new GithubSlugger();
  return (text: string) => slugger.slug(text) || slugger.slug('section');
}

/** Headings in document order with GitHub-style unique anchors (CJK-safe). */
export function collectHeadings(root: Root): { node: MdHeading; heading: Heading }[] {
  const slug = createSlugger();
  const out: { node: MdHeading; heading: Heading }[] = [];
  visit(root, 'heading', (node) => {
    const text = nodeText(node).trim();
    out.push({ node, heading: { depth: node.depth, text, anchor: slug(text) } });
  });
  return out;
}

export interface CheckboxItem {
  node: ListItem;
  checked: boolean;
  /** Text of the item's first paragraph. */
  text: string;
  /** Nearest preceding level-2 heading text, if any. */
  h2: string | null;
}

/**
 * Every GFM task-list item (`- [ ]`, `* [x]`, `+ [X]`, indentation allowed).
 * Items inside fenced code or HTML comments are never parsed as list items, so they are excluded.
 */
export function collectCheckboxItems(root: Root): CheckboxItem[] {
  const items: CheckboxItem[] = [];
  let h2: string | null = null;
  visit(root, (node) => {
    if (node.type === 'heading' && node.depth === 2) h2 = nodeText(node).trim();
    if (node.type === 'listItem' && typeof node.checked === 'boolean') {
      const first = node.children[0];
      items.push({ node, checked: node.checked, text: first ? nodeText(first).trim() : '', h2 });
    }
  });
  return items;
}

export function firstH1(root: Root): string | null {
  for (const n of root.children) {
    if (n.type === 'heading' && n.depth === 1) return nodeText(n).trim() || null;
  }
  return null;
}
