import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { safeFile } from './safe-read.ts';
import type { DocFormat } from './model.ts';

export const CONSTITUTION_PATH = '.specify/memory/constitution.md';
const ALLOWED_EXT: Record<string, DocFormat> = {
  '.md': 'markdown',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.json': 'json',
  '.graphql': 'text',
  '.proto': 'text',
  '.txt': 'text',
};
const EXCLUDED_DIRS = new Set(['.git', 'node_modules']);

export interface DocEntry {
  id: string;
  /** Project-relative path, always `/`-separated. */
  path: string;
  /** Real absolute path, guaranteed to be inside the project root. */
  absPath: string;
  size: number;
  mtimeMs: number;
  format: DocFormat;
  /** Feature directory name when the file lives in `specs/<feature>/…`. */
  featureId: string | null;
}

export interface ScanResult {
  root: string;
  rootReal: string;
  isSpecKit: boolean;
  docs: Map<string, DocEntry>;
  /** Direct child directories of `specs/` (names). */
  featureDirs: string[];
}

export function docIdFor(relPath: string): string {
  return createHash('sha1').update(relPath).digest('hex').slice(0, 12);
}

export function isExcludedName(name: string): boolean {
  return EXCLUDED_DIRS.has(name) || name.startsWith('.env');
}

export function isInside(rootReal: string, target: string): boolean {
  const rel = path.relative(rootReal, target);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

export function isSpecKitProject(root: string): boolean {
  try {
    return fs.statSync(path.join(root, '.specify')).isDirectory();
  } catch {
    return false;
  }
}

function realInside(rootReal: string, abs: string): string | null {
  try {
    const real = fs.realpathSync(abs);
    return isInside(rootReal, real) ? real : null;
  } catch {
    return null;
  }
}

function toEntry(rootReal: string, relPath: string, real: string): DocEntry | null {
  const format = ALLOWED_EXT[path.extname(relPath).toLowerCase()];
  if (!format) return null;
  let st: fs.Stats;
  try {
    st = fs.statSync(real);
  } catch {
    return null;
  }
  if (!st.isFile()) return null;
  const segs = relPath.split('/');
  const featureId = segs[0] === 'specs' && segs.length >= 3 ? segs[1] : null;
  return {
    id: docIdFor(relPath),
    path: relPath,
    absPath: real,
    size: st.size,
    mtimeMs: st.mtimeMs,
    format,
    featureId,
  };
}

/**
 * Whitelist scan: only the constitution and allowed files under `specs/` are registered.
 * Anything whose real path escapes the project root (`..`, symlinks) is skipped.
 */
export function scanProject(root: string): ScanResult {
  const rootAbs = path.resolve(root);
  const rootReal = fs.realpathSync(rootAbs);
  const docs = new Map<string, DocEntry>();
  const featureDirs: string[] = [];
  const result: ScanResult = {
    root: rootAbs,
    rootReal,
    isSpecKit: isSpecKitProject(rootAbs),
    docs,
    featureDirs,
  };
  if (!result.isSpecKit) return result;

  const add = (e: DocEntry | null) => {
    if (e && safeFile(rootReal, e.path)) docs.set(e.id, e);
  };

  const constReal = realInside(rootReal, path.join(rootReal, CONSTITUTION_PATH));
  if (constReal) add(toEntry(rootReal, CONSTITUTION_PATH, constReal));

  const specsReal = realInside(rootReal, path.join(rootReal, 'specs'));
  if (!specsReal) return result;
  const visited = new Set<string>();

  const walk = (dirReal: string, relDir: string, depth: number) => {
    if (visited.has(dirReal) || depth > 12) return;
    visited.add(dirReal);
    let names: string[];
    try {
      names = fs.readdirSync(dirReal).sort();
    } catch {
      return;
    }
    for (const name of names) {
      if (isExcludedName(name)) continue;
      const rel = `${relDir}/${name}`;
      const real = realInside(rootReal, path.join(dirReal, name));
      if (!real) continue;
      let st: fs.Stats;
      try {
        st = fs.statSync(real);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        if (depth === 0) featureDirs.push(name);
        walk(real, rel, depth + 1);
      } else {
        add(toEntry(rootReal, rel, real));
      }
    }
  };
  walk(specsReal, 'specs', 0);
  return result;
}
