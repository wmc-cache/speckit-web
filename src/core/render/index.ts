import rehypeShikiFromHighlighter from '@shikijs/rehype/core';
import type { Element, Root as HastRoot } from 'hast';
import type { Root } from 'mdast';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import remarkRehype from 'remark-rehype';
import { createHighlighter, type HighlighterGeneric } from 'shiki';
import { unified, type Pluggable } from 'unified';
import { visit } from 'unist-util-visit';
import type { DocFormat, Heading } from '../model.ts';
import { collectHeadings, parseMarkdown } from '../markdown/ast.ts';
import { assignDefinitionAnchors } from '../markdown/ids.ts';
import { rehypeSpecKitLinks, type LinkContext } from './links.ts';

export const PART_SIZE = 1024 * 1024;

const LANGS = [
  'markdown',
  'json',
  'yaml',
  'typescript',
  'javascript',
  'tsx',
  'bash',
  'shellscript',
  'powershell',
  'python',
  'diff',
  'graphql',
  'proto',
  'html',
  'css',
  'sql',
];

let highlighterPromise: Promise<HighlighterGeneric<string, string>> | null = null;
function getHighlighter() {
  highlighterPromise ??= createHighlighter({
    themes: ['github-light', 'github-dark'],
    langs: LANGS,
  }) as Promise<HighlighterGeneric<string, string>>;
  return highlighterPromise;
}

const sanitizeSchema = {
  ...defaultSchema,
  clobberPrefix: '',
  attributes: {
    ...defaultSchema.attributes,
    '*': [...(defaultSchema.attributes?.['*'] ?? []), 'className', 'id'],
  },
};

export interface RenderContext extends LinkContext {
  /** Extra hast plugins run after sanitizing (trusted output), before highlighting. */
  plugins?: Pluggable[];
}

export interface RenderResult {
  html: string;
  outline: Heading[];
  anchors: Record<string, string>;
  htmlParts: string[];
  anchorParts: Record<string, number>;
}

/** ```mermaid blocks become `<pre class="mermaid">` with the raw source, rendered in the browser. */
function rehypeMermaid() {
  return (tree: HastRoot) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'pre') return;
      const code = node.children.find((c): c is Element => c.type === 'element' && c.tagName === 'code');
      const cls = code?.properties.className;
      if (!code || !Array.isArray(cls) || !cls.includes('language-mermaid')) return;
      const text = code.children.map((c) => (c.type === 'text' ? c.value : '')).join('');
      node.properties = { className: ['mermaid'] };
      node.children = [{ type: 'text', value: text }];
    });
  };
}

export async function renderMarkdown(text: string, ctx: RenderContext): Promise<RenderResult> {
  const mdast: Root = parseMarkdown(text);
  const outline = collectHeadings(mdast).map(({ node, heading }) => {
    node.data = { ...node.data, hProperties: { ...(node.data?.hProperties ?? {}), id: heading.anchor } };
    return heading;
  });
  const anchors = assignDefinitionAnchors(mdast);
  const highlighter = await getHighlighter();
  const processor = unified()
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSanitize, sanitizeSchema)
    .use(rehypeSpecKitLinks, ctx)
    .use(ctx.plugins ?? [])
    .use(rehypeMermaid)
    .use(rehypeShikiFromHighlighter, highlighter, {
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: false,
      fallbackLanguage: 'text',
      onError: () => {},
    })
    .use(rehypeStringify);
  const hast = (await processor.run(mdast)) as HastRoot;
  const htmlParts: string[] = [];
  const anchorParts: Record<string, number> = {};
  let chunk = '';
  for (const child of hast.children) {
    const html = processor.stringify({ type: 'root', children: [child] });
    if (chunk && Buffer.byteLength(chunk) + Buffer.byteLength(html) > PART_SIZE) {
      htmlParts.push(chunk);
      chunk = '';
    }
    visit({ type: 'root', children: [child] } as HastRoot, 'element', (node: Element) => {
      if (typeof node.properties.id === 'string') anchorParts[node.properties.id] = htmlParts.length;
    });
    chunk += html;
  }
  if (chunk || !htmlParts.length) htmlParts.push(chunk);
  return { html: htmlParts.join(''), htmlParts, anchorParts, outline, anchors };
}

const CODE_LANG: Record<string, string> = { yaml: 'yaml', json: 'json' };

function langForPath(p: string, format: DocFormat): string {
  if (CODE_LANG[format]) return CODE_LANG[format];
  if (p.endsWith('.graphql')) return 'graphql';
  if (p.endsWith('.proto')) return 'proto';
  return 'text';
}

/** Non-Markdown documents are shown as one highlighted code block. */
export function asMarkdownSource(text: string, docPath: string, format: DocFormat): string {
  if (format === 'markdown') return text;
  const longest = Math.max(2, ...[...text.matchAll(/`+/g)].map((m) => m[0].length));
  const fence = '`'.repeat(longest + 1);
  return `${fence}${langForPath(docPath, format)}\n${text}\n${fence}\n`;
}

/** Split documents larger than PART_SIZE bytes at line boundaries. */
export function splitParts(text: string): string[] {
  if (Buffer.byteLength(text) <= PART_SIZE) return [text];
  const parts: string[] = [];
  let current = '';
  let size = 0;
  for (const line of text.split(/(?<=\n)/)) {
    const len = Buffer.byteLength(line);
    if (size + len > PART_SIZE && current) {
      parts.push(current);
      current = '';
      size = 0;
    }
    current += line;
    size += len;
  }
  if (current) parts.push(current);
  return parts;
}
