import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FIXTURES } from '../fixtures/setup.ts';

const isWin = process.platform === 'win32';

/** A PATH that contains `node` and, optionally, the fake `specify` — and nothing else. */
export function isolatedPath(withSpecify: boolean): string {
  const nodeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skw-node-'));
  const nodeLink = path.join(nodeDir, isWin ? 'node.exe' : 'node');
  try {
    fs.symlinkSync(process.execPath, nodeLink);
  } catch {
    fs.copyFileSync(process.execPath, nodeLink);
  }
  const dirs = [nodeDir];
  if (withSpecify) dirs.unshift(path.join(FIXTURES, 'bin'));
  if (isWin) dirs.push(path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32'));
  return dirs.join(path.delimiter);
}

export function fakeEnv(withSpecify = true, extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  return { ...process.env, PATH: isolatedPath(withSpecify), Path: undefined, ...extra } as NodeJS.ProcessEnv;
}

export function tmpDir(prefix = 'skw-init-'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}
