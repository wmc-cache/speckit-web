import type { DocFormat, SearchIndexEntry } from './model.ts';
import { collectHeadings, nodeText, parseMarkdown } from './markdown/ast.ts';

/** Plain text of a document (Markdown markup removed) plus heading offsets for mapping hits back to sections. */
export function buildSearchText(
  text: string,
  format: DocFormat,
): Pick<SearchIndexEntry, 'text' | 'headings'> {
  if (format !== 'markdown') return { text, headings: [] };
  const root = parseMarkdown(text);
  const anchors = new Map(collectHeadings(root).map(({ node, heading }) => [node, heading.anchor]));
  let out = '';
  const headings: SearchIndexEntry['headings'] = [];
  for (const node of root.children) {
    if (node.type === 'html') continue;
    const t = nodeText(node);
    if (!t) continue;
    if (node.type === 'heading')
      headings.push({ offset: out.length, anchor: anchors.get(node) ?? '', text: t });
    out += `${t}\n`;
  }
  return { text: out, headings };
}
