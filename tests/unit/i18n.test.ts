import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO } from '../fixtures/setup.ts';

const load = (rel: string) =>
  JSON.parse(fs.readFileSync(path.join(REPO, rel), 'utf8')) as Record<string, string>;

describe.each([
  ['CLI', 'src/i18n'],
  ['web', 'web/src/i18n'],
])('%s dictionaries', (_name, dir) => {
  const en = load(`${dir}/en.json`);
  const zh = load(`${dir}/zh-CN.json`);

  it('have exactly the same keys in English and Chinese', () => {
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort());
  });

  it('have no empty values and the same placeholders', () => {
    for (const [k, v] of Object.entries(en)) {
      expect(v.trim(), `en ${k}`).not.toBe('');
      expect(zh[k].trim(), `zh ${k}`).not.toBe('');
      const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      expect(vars(zh[k]), k).toEqual(vars(en[k]));
    }
  });
});
