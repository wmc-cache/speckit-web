import { serve } from '@hono/node-server';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import open from 'open';
import { ProjectStore } from '../core/project.ts';
import { t } from '../i18n/index.ts';
import { webRoot } from '../paths.ts';
import { createApp, EventHub } from '../server/app.ts';
import { mountInitRoutes } from '../server/init-routes.ts';
import { findPort } from '../server/port.ts';
import { startWatcher } from '../server/watch.ts';
import { CliError, EXIT } from './exit-codes.ts';

export interface ServeOptions {
  port: number;
  open: boolean;
}

export async function runServe(dir: string, opts: ServeOptions): Promise<void> {
  const root = path.resolve(dir);
  let st: fs.Stats;
  try {
    st = fs.statSync(root);
  } catch {
    throw new CliError(t('err.dirMissing', { dir: root }), EXIT.BAD_ARGS);
  }
  if (!st.isDirectory()) throw new CliError(t('err.dirMissing', { dir: root }), EXIT.BAD_ARGS);
  try {
    fs.readdirSync(root);
  } catch {
    throw new CliError(t('serve.permission', { dir: root }), EXIT.RUNTIME_ERROR);
  }

  const wanted = Number.isInteger(opts.port) && opts.port > 0 ? opts.port : 5178;
  let port: number;
  try {
    port = await findPort(wanted);
  } catch {
    throw new CliError(t('serve.noPort', { port: wanted }), EXIT.RUNTIME_ERROR);
  }

  const store = new ProjectStore(root);
  const events = new EventHub();
  const token = crypto.randomBytes(24).toString('hex');
  const onWatchError = (err: Error) => console.error(t('serve.watchFailed', { msg: err.message }));
  const watcher = startWatcher(store, events, onWatchError);
  const app = createApp({
    store,
    events,
    port: () => port,
    token,
    webRoot: webRoot(),
    startRoot: root,
    routes: (a) =>
      mountInitRoutes(a, { store, events, startRoot: root, token, onRootChange: () => watcher.restart() }),
  });

  const server = serve({ fetch: app.fetch, port, hostname: '127.0.0.1' });
  await new Promise<void>((resolve, reject) => {
    server.once('listening', () => resolve());
    server.once('error', reject);
  });

  const url = `http://localhost:${port}/`;
  if (port !== wanted) console.log(t('serve.portChanged', { wanted, port }));
  console.log(t('serve.started', { url }));
  if (!store.isSpecKit) console.log(t('serve.notSpecKit', { dir: root }));
  console.log(t('serve.stop'));
  if (opts.open) void open(url).catch(() => {});

  const shutdown = () => {
    void watcher.close();
    server.close();
    process.exit(EXIT.OK);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}
