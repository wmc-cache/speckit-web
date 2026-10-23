import type {
  DocumentData,
  Feature,
  ProjectResponse,
  SearchIndexEntry,
  SearchResult,
} from '../../../src/core/model.ts';
import type { DataSource } from './source.ts';

async function getJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return (await res.json()) as T;
}

/** Reads the JSON files written by `speckit-web build` (relative to the page, so any sub-path works). */
export class StaticSource implements DataSource {
  readonly mode = 'static' as const;
  private worker: Worker | null = null;
  private seq = 0;
  private pending = new Map<number, (r: SearchResult) => void>();

  async getProject() {
    return (await getJson<ProjectResponse>('data/project.json'))!;
  }
  getFeature(id: string) {
    return getJson<Feature>(`data/features/${encodeURIComponent(id)}.json`);
  }
  getDoc(id: string, part = 0) {
    if (!/^[0-9a-f]{12}$/.test(id)) return Promise.resolve(null);
    return getJson<DocumentData>(`data/docs/${id}${part ? `.part-${part}` : ''}.json`);
  }

  search(q: string, limit = 50): Promise<SearchResult> {
    if (!this.worker) {
      this.worker = new Worker(new URL('../workers/search.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e: MessageEvent<{ id: number; result: SearchResult }>) => {
        this.pending.get(e.data.id)?.(e.data.result);
        this.pending.delete(e.data.id);
      };
    }
    const id = ++this.seq;
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      this.worker!.postMessage({ id, q, limit, indexUrl: new URL('data/search.json', location.href).href });
    });
  }

  subscribe() {
    return () => {};
  }
}

export type { SearchIndexEntry };
