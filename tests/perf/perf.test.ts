import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { beforeAll, describe, expect, it } from 'vitest';
import { ProjectStore } from '../../src/core/project.ts';
import { searchEntries } from '../../src/core/search.ts';
import { generateProject } from './generate.ts';

const root = path.join(os.tmpdir(), 'speckit-web-perf');
const p95 = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length * 0.95) - 1];
let store: ProjectStore;

beforeAll(() => {
  generateProject(root, 50, 500);
});

describe('performance (SC-002, SC-003)', () => {
  it('loads a 50-feature / 500-document project quickly', () => {
    const t0 = performance.now();
    store = new ProjectStore(root);
    const ms = performance.now() - t0;
    expect(store.entries().length).toBeGreaterThanOrEqual(450);
    expect(ms).toBeLessThan(10_000);
  });

  it('opens documents with P95 ≤ 1 s', async () => {
    const entries = store.entries();
    const times: number[] = [];
    for (let i = 0; i < 40; i++) {
      const e = entries[(i * 37) % entries.length];
      const t0 = performance.now();
      await store.getDoc(e.id);
      times.push(performance.now() - t0);
    }
    expect(p95(times)).toBeLessThan(1000);
  });

  it('searches with P95 ≤ 1 s, including building the index', () => {
    const t0 = performance.now();
    const index = store.searchIndex();
    const indexMs = performance.now() - t0;
    const times: number[] = [];
    for (const q of [
      'zanzibar',
      'requirement',
      'FR-007',
      'behaviour under load',
      'nothing-matches-this',
      'feature 42',
      '实现',
    ]) {
      for (let i = 0; i < 3; i++) {
        const s = performance.now();
        searchEntries(index, q, 50);
        times.push(performance.now() - s);
      }
    }
    expect(searchEntries(index, 'zanzibar').total).toBe(1);
    expect(indexMs).toBeLessThan(10_000);
    expect(p95(times)).toBeLessThan(1000);
  });
});
