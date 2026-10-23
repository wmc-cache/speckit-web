import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { SearchIndexEntry } from '../../src/core/model.ts';
import { ProjectStore } from '../../src/core/project.ts';
import { normalize, searchEntries } from '../../src/core/search.ts';
import { DEMO, FIXTURES } from '../fixtures/setup.ts';

const entry = (over: Partial<SearchIndexEntry>): SearchIndexEntry => ({
  docId: 'id',
  featureId: null,
  featureOrder: 0,
  title: 'Doc',
  path: 'specs/doc.md',
  text: '',
  headings: [],
  ...over,
});

describe('search', () => {
  it('finds Chinese substrings without word segmentation', () => {
    const store = new ProjectStore(DEMO);
    const r = searchEntries(store.searchIndex(), '登录', 50);
    expect(r.hits.map((h) => h.path).sort()).toEqual([
      'specs/002-user-login/plan.md',
      'specs/002-user-login/spec.md',
    ]);
    expect(r.total).toBe(2);
  });

  it('normalizes case and full-width characters without changing length', () => {
    expect(normalize('ＡＢＣ　Ｘ１')).toBe('abc x1');
    expect(normalize('İstanbul').length).toBe('İstanbul'.length);
    const r = searchEntries([entry({ text: 'Uses PostgreSQL for storage' })], 'ｐｏｓｔｇｒｅｓｑｌ', 10);
    expect(r.total).toBe(1);
  });

  it('ranks title hits above body-only hits, then by feature order', () => {
    const entries = [
      entry({ docId: 'a', featureOrder: 0, title: 'Overview', text: 'calendar calendar calendar' }),
      entry({ docId: 'b', featureOrder: 2, title: 'Calendar plan', text: 'nothing' }),
      entry({ docId: 'c', featureOrder: 1, title: 'Other', text: 'one calendar' }),
    ];
    expect(searchEntries(entries, 'calendar', 10).hits.map((h) => h.docId)).toEqual(['b', 'a', 'c']);
  });

  it('escapes snippets except for the <mark> around the match and maps hits to headings', () => {
    const text = 'Intro <script>alert(1)</script> text\nSection body mentions login here';
    const r = searchEntries(
      [
        entry({
          text,
          headings: [
            { offset: 0, anchor: 'intro', text: 'Intro' },
            { offset: text.indexOf('Section'), anchor: 'section', text: 'Section' },
          ],
        }),
      ],
      'LOGIN',
      10,
    );
    expect(r.hits[0].anchor).toBe('section');
    expect(r.hits[0].snippet).toContain('<mark>login</mark>');
    expect(searchEntries([entry({ text })], 'alert', 10).hits[0].snippet).not.toContain('<script>');
    expect(searchEntries([entry({ text })], 'alert', 10).hits[0].snippet).toContain('&lt;script&gt;');
  });

  it('limits results: default 50, maximum 200', () => {
    const many = Array.from({ length: 300 }, (_, i) => entry({ docId: String(i), text: 'needle' }));
    expect(searchEntries(many, 'needle').hits).toHaveLength(50);
    expect(searchEntries(many, 'needle', 500).hits).toHaveLength(200);
    expect(searchEntries(many, 'needle', 500).total).toBe(300);
  });

  it('indexes every document of a project including the constitution', () => {
    const store = new ProjectStore(path.join(FIXTURES, 'basic'));
    const idx = store.searchIndex();
    expect(idx.length).toBe(store.entries().length);
    expect(searchEntries(idx, 'keep it simple').hits[0].path).toBe('.specify/memory/constitution.md');
  });
});
