import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { ProjectStore } from '../../src/core/project.ts';
import { asMarkdownSource, renderMarkdown, splitParts, PART_SIZE } from '../../src/core/render/index.ts';
import { docIdFor } from '../../src/core/scan.ts';
import { cleanupFixtures, copyFixture, FIXTURES, writeBigDoc } from '../fixtures/setup.ts';

afterAll(cleanupFixtures);

const ctx = {
  docPath: 'specs/001-a/spec.md',
  docId: 'self',
  resolveDoc: (p: string) => (p === 'specs/001-a/plan.md' ? 'planid' : null),
};

describe('renderMarkdown', () => {
  it('renders tables, task checkboxes, highlighted code and mermaid blocks', async () => {
    const md =
      '| a | b |\n|---|---|\n| 1 | 2 |\n\n- [x] T001 done\n- [ ] T002 todo\n\n```ts\nconst a = 1;\n```\n\n```mermaid\ngraph TD; A-->B\n```\n';
    const { html, anchors } = await renderMarkdown(md, ctx);
    expect(html).toContain('<table>');
    expect(html).toContain('<input type="checkbox" checked disabled>');
    expect(html).toContain('class="shiki');
    expect(html).toContain('<pre class="mermaid">graph TD; A-->B');
    expect(anchors).toEqual({ T001: 't001', T002: 't002' });
  });

  it('sanitizes scripts, event handlers and javascript: URLs', async () => {
    const md =
      '<script>alert(1)</script>\n\n<img src="x" onerror="alert(1)">\n\n[x](javascript:alert(1)) <a href="#" onclick="alert(1)">y</a>\n';
    const { html } = await renderMarkdown(md, ctx);
    expect(html).not.toMatch(/<script|onerror|onclick|javascript:/i);
  });

  it('rewrites relative links, keeps fragments and marks unpublished files', async () => {
    const md = '[plan](./plan.md#summary) [src](../../src/a.ts) [self](#intro) [ext](https://example.com)';
    const { html } = await renderMarkdown(md, ctx);
    expect(html).toContain('href="#/d/planid?h=summary"');
    expect(html).toContain('data-unpublished="src/a.ts"');
    expect(html).toContain('href="#/d/self?h=intro"');
    expect(html).toContain('target="_blank"');
  });

  it('builds a CJK-safe outline with unique anchors', async () => {
    const { outline, html } = await renderMarkdown('# 标题\n\n## 概述\n\n## 概述\n', ctx);
    expect(outline.map((h) => h.anchor)).toEqual(['标题', '概述', '概述-1']);
    expect(html).toContain('<h2 id="概述-1">');
  });

  it('renders malformed Markdown without throwing', async () => {
    const md = '```js\nunclosed fence\n\n| a | b |\n|---|\n| 1 | 2 | 3 |\n';
    await expect(renderMarkdown(md, ctx)).resolves.toBeTruthy();
  });

  it('wraps non-Markdown documents in a fence longer than any backtick run', () => {
    expect(asMarkdownSource('a: ```x```', 'x.yaml', 'yaml')).toMatch(/^````yaml\n/);
  });
});

describe('large documents', () => {
  it('splits documents over 1 MB into parts and loads each part', async () => {
    const root = copyFixture('basic');
    writeBigDoc(path.join(root, 'specs/001-alpha/big.md'));
    const store = new ProjectStore(root);
    const id = docIdFor('specs/001-alpha/big.md');
    const first = await store.getDoc(id);
    expect(first?.truncated).toBe(true);
    expect(first?.parts).toBe(2);
    const second = await store.getDoc(id, 1);
    expect(second?.part).toBe(1);
    expect(await store.getDoc(id, 2)).toBeNull();
    expect(splitParts('x'.repeat(10))).toHaveLength(1);
    expect(Buffer.byteLength(splitParts('line\n'.repeat(PART_SIZE / 4))[0])).toBeLessThanOrEqual(PART_SIZE);
  }, 30000);

  it('returns null for unknown document ids', async () => {
    expect(await new ProjectStore(path.join(FIXTURES, 'basic')).getDoc('nope')).toBeNull();
  });
});
