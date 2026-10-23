import type {
  ChangeEvent,
  DocumentData,
  Feature,
  ProjectResponse,
  SearchResult,
  ViewMode,
} from '../../../src/core/model.ts';
import { LocalSource } from './local.ts';
import { StaticSource } from './static.ts';

export type ConnectionState = 'connected' | 'disconnected';

export interface DataSource {
  readonly mode: ViewMode;
  getProject(): Promise<ProjectResponse>;
  getFeature(id: string): Promise<Feature | null>;
  getDoc(id: string, part?: number): Promise<DocumentData | null>;
  search(q: string, limit?: number): Promise<SearchResult>;
  /** Subscribe to change events; returns an unsubscribe function. Static sources never emit. */
  subscribe(onChange: (e: ChangeEvent) => void, onConnection?: (s: ConnectionState) => void): () => void;
}

export function readMeta(name: string): string | null {
  return document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content ?? null;
}

export function createDataSource(): DataSource {
  return readMeta('speckit-web-mode') === 'local'
    ? new LocalSource(readMeta('speckit-web-token') ?? '')
    : new StaticSource();
}
