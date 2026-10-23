import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ProjectStore } from '../../src/core/project.ts';
import { createApp, EventHub } from '../../src/server/app.ts';
import { webRoot } from '../../src/paths.ts';

export const PORT = 5178;

/** Response whose JSON body is loosely typed (tests assert on shapes). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JsonResponse = Omit<Response, 'json'> & { json(): Promise<any> };
export const TOKEN = 'test-token';

/** Makes sure a (possibly fake) web build exists so static serving can be tested without `vite build`. */
export function ensureWebRoot(): string {
  const root = webRoot();
  const index = path.join(root, 'index.html');
  if (!fs.existsSync(index)) {
    fs.mkdirSync(path.join(root, 'assets'), { recursive: true });
    fs.writeFileSync(
      index,
      '<!doctype html><html><head><meta name="speckit-web-mode" content="static" />\n<meta name="speckit-web-token" content="" /></head><body></body></html>',
    );
    fs.writeFileSync(path.join(root, 'assets', 'app.js'), 'console.log(1)');
  }
  return root;
}

export function makeApp(root: string) {
  const store = new ProjectStore(root);
  const events = new EventHub();
  const app = createApp({
    store,
    events,
    port: () => PORT,
    token: TOKEN,
    webRoot: ensureWebRoot(),
    startRoot: root,
  });
  const get = (url: string, headers: Record<string, string> = {}) =>
    app.request(url, { headers: { host: `localhost:${PORT}`, ...headers } }) as Promise<JsonResponse>;
  const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
    app.request(url, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        host: `localhost:${PORT}`,
        'content-type': 'application/json',
        'x-speckit-web-token': TOKEN,
        ...headers,
      },
    }) as Promise<JsonResponse>;
  return { app, store, events, get, post };
}

/** SHA-256 of every file under root (to prove nothing was modified). */
export function hashTree(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      const st = fs.lstatSync(p);
      if (st.isSymbolicLink()) continue;
      if (st.isDirectory()) walk(p);
      else out[path.relative(root, p)] = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
    }
  };
  walk(root);
  return out;
}
