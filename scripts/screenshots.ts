// Generates README screenshots of the demo project (light/dark × zh-CN/en) into docs/screenshots/.
// Usage: pnpm build && pnpm screenshots   (PW_CHANNEL=chrome to use the installed Google Chrome)
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(repo, 'docs', 'screenshots');
fs.mkdirSync(outDir, { recursive: true });
const id = (rel: string) => crypto.createHash('sha1').update(rel).digest('hex').slice(0, 12);

const port = 5299;
const server = spawn(
  process.execPath,
  [
    path.join(repo, 'dist/cli.js'),
    path.join(repo, 'examples/demo-project'),
    '--no-open',
    '--port',
    String(port),
  ],
  {
    stdio: ['ignore', 'pipe', 'inherit'],
  },
);
await new Promise<void>((resolve) =>
  server.stdout!.on('data', (d: Buffer) => d.toString().includes('http://') && resolve()),
);

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });
const shots: [string, string][] = [
  ['overview', ''],
  ['feature', '#/f/002-user-login'],
  ['document', `#/d/${id('specs/002-user-login/plan.md')}`],
  ['search', '#/search?q=%E7%99%BB%E5%BD%95'],
];
try {
  for (const lang of ['zh-CN', 'en'] as const) {
    for (const theme of ['light', 'dark'] as const) {
      const page = await browser.newPage({
        viewport: { width: 1360, height: 860 },
        colorScheme: theme,
        deviceScaleFactor: 2,
      });
      await page.addInitScript(([l]) => localStorage.setItem('speckit-web.lang', l), [lang]);
      for (const [name, hash] of shots) {
        await page.goto(`http://127.0.0.1:${port}/${hash}`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(outDir, `${name}-${lang}-${theme}.png`) });
      }
      await page.close();
    }
  }
  console.log(`Screenshots written to ${path.relative(repo, outDir)}/`);
} finally {
  await browser.close();
  server.kill();
}
