import { normalize } from '../../../src/core/search.ts';
/** Wraps case-insensitive occurrences of `query` in text nodes with <mark class="search-highlight">. */
export function highlightText(root: HTMLElement, query: string): HTMLElement | null {
  for (const mark of root.querySelectorAll('mark.search-highlight'))
    mark.replaceWith(document.createTextNode(mark.textContent ?? ''));
  root.normalize();
  const q = normalize(query.trim());
  if (!q) return null;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) =>
      n.parentElement?.closest('pre.mermaid, script, style, mark')
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  });
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  let first: HTMLElement | null = null;
  for (const node of nodes) {
    const text = node.nodeValue ?? '';
    const lower = normalize(text);
    let idx = lower.indexOf(q);
    if (idx < 0) continue;
    const frag = document.createDocumentFragment();
    let last = 0;
    while (idx >= 0) {
      frag.append(text.slice(last, idx));
      const mark = document.createElement('mark');
      mark.className = 'search-highlight';
      mark.textContent = text.slice(idx, idx + q.length);
      frag.append(mark);
      first ??= mark;
      last = idx + q.length;
      idx = lower.indexOf(q, last);
    }
    frag.append(text.slice(last));
    node.replaceWith(frag);
  }
  return first;
}
