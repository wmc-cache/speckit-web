/// <reference lib="webworker" />
import type { SearchIndexEntry } from '../../../src/core/model.ts';
import { searchEntries } from '../../../src/core/search.ts';

let index: Promise<SearchIndexEntry[]> | null = null;

self.onmessage = async (e: MessageEvent<{ id: number; q: string; limit: number; indexUrl: string }>) => {
  const { id, q, limit, indexUrl } = e.data;
  index ??= fetch(indexUrl).then((r) => r.json() as Promise<SearchIndexEntry[]>);
  try {
    self.postMessage({ id, result: searchEntries(await index, q, limit) });
  } catch {
    index = null;
    self.postMessage({ id, result: { query: q, hits: [], total: 0 } });
  }
};
