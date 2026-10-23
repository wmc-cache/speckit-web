import { watch, type FSWatcher } from 'chokidar';
import path from 'node:path';
import type { ProjectStore } from '../core/project.ts';
import { isExcludedName } from '../core/scan.ts';
import type { EventHub } from './app.ts';

const DEBOUNCE_MS = 200;

/** Only `.specify/memory/**`, `.specify/*.json` and `specs/**` matter; the root itself is watched so a new `.specify/` is noticed. */
export function isWatchedPath(root: string, p: string): boolean {
  const rel = path.relative(root, p).split(path.sep).join('/');
  if (rel === '') return true;
  if (rel.startsWith('..')) return false;
  const segs = rel.split('/');
  if (segs.some(isExcludedName)) return false;
  if (segs[0] === 'specs') return true;
  if (segs[0] !== '.specify') return false;
  if (segs.length === 1) return true;
  if (segs[1] === 'memory') return true;
  return segs.length === 2 && segs[1].endsWith('.json');
}

export interface Watcher {
  restart(): void;
  close(): Promise<void>;
}

export function startWatcher(store: ProjectStore, events: EventHub, onError: (err: Error) => void): Watcher {
  let watcher: FSWatcher | null = null;
  let timer: NodeJS.Timeout | null = null;

  const flush = () => {
    timer = null;
    for (const e of store.refresh()) events.emit(e);
  };
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, DEBOUNCE_MS);
  };

  const start = () => {
    const root = store.root;
    watcher = watch(root, {
      ignoreInitial: true,
      ignored: (p: string) => !isWatchedPath(root, p),
    });
    watcher.on('all', schedule);
    watcher.on('error', (err) => onError(err instanceof Error ? err : new Error(String(err))));
  };

  start();
  return {
    restart() {
      void watcher?.close();
      start();
    },
    async close() {
      if (timer) clearTimeout(timer);
      await watcher?.close();
    },
  };
}
