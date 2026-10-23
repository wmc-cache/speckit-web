import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let cached: string | null = null;

/** Root of the installed speckit-web package (works from src/ in dev and from dist/ when published). */
export function packageRoot(): string {
  if (cached) return cached;
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (;;) {
    const pj = path.join(dir, 'package.json');
    if (fs.existsSync(pj)) {
      try {
        if (JSON.parse(fs.readFileSync(pj, 'utf8')).name === 'speckit-web') return (cached = dir);
      } catch {
        // keep walking up
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error('speckit-web package root not found');
    dir = parent;
  }
}

export function packageVersion(): string {
  return JSON.parse(fs.readFileSync(path.join(packageRoot(), 'package.json'), 'utf8')).version as string;
}

/** Pre-built web app (`vite build` output). */
export function webRoot(): string {
  return path.join(packageRoot(), 'dist', 'web');
}
