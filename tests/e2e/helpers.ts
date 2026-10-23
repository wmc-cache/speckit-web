import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CLI = path.join(REPO, 'dist', 'cli.js');
let nextPort = 5300 + Math.floor(Math.random() * 400);

export function ensureBuilt(): void {
  if (!fs.existsSync(CLI) || !fs.existsSync(path.join(REPO, 'dist/web/index.html'))) {
    throw new Error('Run `pnpm build` before the e2e tests.');
  }
}

export function copyDemo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skw-e2e-'));
  const dest = path.join(dir, 'demo-project');
  fs.cpSync(path.join(REPO, 'examples/demo-project'), dest, { recursive: true });
  return dest;
}

export interface Served {
  url: string;
  stop: () => void;
}

/** Starts `speckit-web <dir>` and resolves once it prints its URL. */
export async function serveLocal(dir: string, env: NodeJS.ProcessEnv = process.env): Promise<Served> {
  ensureBuilt();
  const port = nextPort++;
  const child: ChildProcess = spawn(process.execPath, [CLI, dir, '--no-open', '--port', String(port)], {
    env: { ...env, LANG: 'en_US.UTF-8' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const actual = await new Promise<number>((resolve, reject) => {
    let out = '';
    const timer = setTimeout(() => reject(new Error(`server did not start:\n${out}`)), 15000);
    const onData = (d: Buffer) => {
      out += d.toString();
      const m = /http:\/\/localhost:(\d+)\//.exec(out);
      if (m) {
        clearTimeout(timer);
        resolve(Number(m[1]));
      }
    };
    child.stdout!.on('data', onData);
    child.stderr!.on('data', onData);
    child.on('exit', (code) => reject(new Error(`server exited with ${code}:\n${out}`)));
  });
  return { url: `http://127.0.0.1:${actual}/`, stop: () => child.kill() };
}

/** Builds the static site and serves its parent directory, so the site lives under the `/site/` sub-path. */
export async function serveStatic(dir: string): Promise<Served> {
  ensureBuilt();
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'skw-static-'));
  const out = path.join(parent, 'site');
  execFileSync(process.execPath, [CLI, 'build', dir, '--out', out], { stdio: 'ignore' });
  const types: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
  };
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent((req.url ?? '/').split('?')[0]);
    let file = path.join(parent, rel);
    if (rel.endsWith('/')) file = path.join(file, 'index.html');
    if (!file.startsWith(parent) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  const port = await new Promise<number>((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve((server.address() as { port: number }).port)),
  );
  return { url: `http://127.0.0.1:${port}/site/`, stop: () => server.close() };
}

export async function useChinese(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('speckit-web.lang', 'zh-CN'));
}

export function docId(rel: string): string {
  // Same as src/core/scan.ts docIdFor (sha1 of the project-relative path, 12 hex chars).
  return execFileSync(
    process.execPath,
    [
      '-e',
      `process.stdout.write(require('crypto').createHash('sha1').update(${JSON.stringify(rel)}).digest('hex').slice(0,12))`,
    ],
    {
      encoding: 'utf8',
    },
  );
}
