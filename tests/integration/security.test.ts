import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { docIdFor } from '../../src/core/scan.ts';
import { addHostileFiles, cleanupFixtures, copyFixture } from '../fixtures/setup.ts';
import { hashTree, makeApp } from './helpers.ts';

let root: string;
let ctx: ReturnType<typeof makeApp>;
let before: Record<string, string>;

beforeAll(() => {
  root = copyFixture('with-secrets');
  addHostileFiles(root);
  before = hashTree(root);
  ctx = makeApp(root);
});
afterAll(cleanupFixtures);

describe('security', () => {
  it('returns 404 DOC_NOT_FOUND for files that are excluded or escape the root', async () => {
    for (const rel of [
      'specs/001-x/leak.md',
      'specs/001-x/leak-dir/secret.md',
      'specs/001-x/.env',
      'specs/001-x/.env.md',
      'specs/001-x/node_modules/dep.md',
      'specs/.git/HEAD.md',
      '.git/config',
      'src/app.ts',
      'specs/001-x/notes.ts',
      '.specify/memory/private-notes.txt',
    ]) {
      const res = await ctx.get(`/api/docs/${docIdFor(rel)}`);
      expect(res.status, rel).toBe(404);
      expect((await res.json()).error).toBe('DOC_NOT_FOUND');
    }
  });

  it('does not accept paths, traversal or URL-encoded traversal as document ids', async () => {
    for (const id of [
      '..%2F..%2Fsrc%2Fapp.ts',
      '%2e%2e%2f%2e%2e%2fetc%2fpasswd',
      'specs%2F001-x%2Fspec.md',
      '..',
    ]) {
      const res = await ctx.get(`/api/docs/${id}`);
      expect(res.status, id).toBe(404);
    }
  });

  it('does not serve files outside the web root through static routes', async () => {
    for (const p of [
      '/../../package.json',
      '/%2e%2e/%2e%2e/package.json',
      '/assets/..%2f..%2f..%2fpackage.json',
    ]) {
      const res = await ctx.get(p);
      const text = await res.text();
      expect(text, p).not.toContain('"name": "speckit-web"');
    }
  });

  it('rejects forged Host headers with 403 FORBIDDEN_HOST', async () => {
    for (const host of [
      'evil.example.com',
      'localhost.evil.com:5178',
      'localhost:9999',
      '192.168.1.10:5178',
    ]) {
      const res = await ctx.get('/api/project', { host });
      expect(res.status, host).toBe(403);
      expect((await res.json()).error).toBe('FORBIDDEN_HOST');
    }
    expect((await ctx.get('/api/project', { host: '127.0.0.1:5178' })).status).toBe(200);
  });

  it('never leaks contents of excluded files through rendered documents', async () => {
    const res = await ctx.get(`/api/docs/${docIdFor('specs/001-x/spec.md')}`);
    const doc = await res.json();
    expect(doc.html).not.toContain('do-not-leak');
    expect(doc.html).toContain('data-unpublished="src/app.ts"');
  });

  it('leaves every project file unchanged while browsing', async () => {
    await ctx.get('/api/project');
    for (const e of ctx.store.entries()) await ctx.get(`/api/docs/${e.id}`);
    await ctx.get('/api/features/001-x');
    expect(hashTree(root)).toEqual(before);
    expect(path.isAbsolute(root)).toBe(true);
  });
});
