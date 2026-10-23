import fs from 'node:fs';
import path from 'node:path';
import { Hono, type Context } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { ApiError, ChangeEvent, ErrorCode } from '../core/model.ts';
import type { ProjectStore } from '../core/project.ts';
import { isInside } from '../core/scan.ts';
import { searchEntries } from '../core/search.ts';
import { packageVersion } from '../paths.ts';

export class EventHub {
  private listeners = new Set<(e: ChangeEvent) => void>();
  on(fn: (e: ChangeEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  emit(e: ChangeEvent): void {
    for (const fn of this.listeners) fn(e);
  }
}

export interface AppOptions {
  store: ProjectStore;
  events: EventHub;
  /** Actual listening port (Host header check). */
  port: () => number;
  /** Random per-process token required by write endpoints. */
  token: string;
  webRoot: string;
  /** Directory the server was started in; init may only target it or a new child of it. */
  startRoot: string;
  /** Extra routes (e.g. the init wizard API), registered before the static catch-all. */
  routes?: (app: Hono) => void;
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
};

const MESSAGES: Record<ErrorCode, string> = {
  NOT_SPECKIT_PROJECT: 'Not a Spec Kit project.',
  FORBIDDEN_HOST: 'Requests are only accepted for localhost.',
  BAD_TOKEN: 'Missing or invalid token.',
  FEATURE_NOT_FOUND: 'Feature not found.',
  DOC_NOT_FOUND: 'Document not found.',
  EMPTY_QUERY: 'The search query is empty.',
  INVALID_OPTIONS: 'Invalid init options.',
  PREREQ_MISSING: 'specify / uvx not found.',
  SPECIFY_FAILED: 'specify failed.',
  PLAN_EXPIRED: 'The init plan expired.',
  CONFIRMATION_REQUIRED: 'Overwriting requires confirmation.',
  APPLY_FAILED: 'Applying the init plan failed.',
};

export function apiError(c: Context, status: number, error: ErrorCode, extra: Record<string, unknown> = {}) {
  const body: ApiError = { error, message: MESSAGES[error], ...extra };
  return c.json(body, status as 400);
}

export function injectMeta(html: string, mode: 'local' | 'static', token: string): string {
  return html
    .replace(
      /<meta name="speckit-web-mode" content="[^"]*"/,
      `<meta name="speckit-web-mode" content="${mode}"`,
    )
    .replace(
      /<meta name="speckit-web-token" content="[^"]*"/,
      `<meta name="speckit-web-token" content="${token}"`,
    );
}

export function createApp(opts: AppOptions): Hono {
  const { store, events, token, webRoot } = opts;
  const app = new Hono();

  // DNS-rebinding protection: only loopback host names on our own port.
  app.use('*', async (c, next) => {
    const host = (c.req.header('host') ?? '').toLowerCase();
    const port = opts.port();
    const allowed = [`localhost:${port}`, `127.0.0.1:${port}`, `[::1]:${port}`];
    if (!allowed.includes(host)) return apiError(c, 403, 'FORBIDDEN_HOST');
    await next();
  });

  app.use('/api/*', async (c, next) => {
    await next();
    c.header('Cache-Control', 'no-store');
  });

  app.get('/api/project', (c) => c.json(store.getProject()));

  app.get('/api/features/:featureId', (c) => {
    const f = store.getFeature(c.req.param('featureId'));
    return f ? c.json(f) : apiError(c, 404, 'FEATURE_NOT_FOUND');
  });

  app.get('/api/docs/:docId', async (c) => {
    const part = Number(c.req.query('part') ?? 0);
    const doc = Number.isInteger(part) ? await store.getDoc(c.req.param('docId'), part) : null;
    return doc ? c.json(doc) : apiError(c, 404, 'DOC_NOT_FOUND');
  });

  app.get('/api/search', (c) => {
    const q = (c.req.query('q') ?? '').trim();
    if (!q) return apiError(c, 400, 'EMPTY_QUERY');
    const limit = Number(c.req.query('limit') ?? 50);
    return c.json(searchEntries(store.searchIndex(), q, Number.isFinite(limit) ? limit : 50));
  });

  app.get('/api/events', (c) =>
    streamSSE(c, async (stream) => {
      await stream.writeSSE({ event: 'hello', data: JSON.stringify({ version: packageVersion() }) });
      const off = events.on((e) => void stream.writeSSE({ event: 'change', data: JSON.stringify(e) }));
      const ping = setInterval(() => void stream.writeSSE({ event: 'ping', data: '{}' }), 25000);
      await new Promise<void>((resolve) => stream.onAbort(resolve));
      clearInterval(ping);
      off();
    }),
  );

  opts.routes?.(app);

  app.get('*', (c) => {
    let rel: string;
    try {
      rel = decodeURIComponent(c.req.path);
    } catch {
      return c.notFound();
    }
    if (rel === '/' || rel === '') rel = '/index.html';
    const file = path.resolve(webRoot, `.${rel}`);
    if (!isInside(webRoot, file) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return c.notFound();
    const ext = path.extname(file).toLowerCase();
    if (ext === '.html') {
      return c.html(injectMeta(fs.readFileSync(file, 'utf8'), 'local', token), 200, {
        'Cache-Control': 'no-store',
      });
    }
    return c.body(fs.readFileSync(file), 200, {
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
      'Cache-Control': rel.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
  });

  return app;
}
