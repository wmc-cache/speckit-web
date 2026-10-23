import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

/** Refuse symbolic links anywhere below the canonical starting directory. */
export function assertTarget(base: string, target: string): void {
  const rel = path.relative(base, target);
  if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel))
    throw new Error('init.error.targetUnsafe');
  let current = base;
  for (const part of rel.split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    try {
      if (fs.lstatSync(current).isSymbolicLink()) throw new Error('init.error.targetUnsafe');
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    }
  }
}

/** Includes unrelated entries: a changed preview must never silently authorize new writes. */
export function targetFingerprint(base: string, target: string): string {
  assertTarget(base, target);
  const hash = createHash('sha256');
  const walk = (file: string) => {
    let st: fs.Stats;
    try {
      st = fs.lstatSync(file);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
        hash.update('missing');
        return;
      }
      throw e;
    }
    hash.update(`${path.relative(target, file)}:${st.mode}:`);
    if (st.isSymbolicLink()) hash.update(fs.readlinkSync(file));
    else if (st.isDirectory()) for (const name of fs.readdirSync(file).sort()) walk(path.join(file, name));
    else if (st.isFile()) hash.update(fs.readFileSync(file));
    else throw new Error('init.error.targetUnsafe');
  };
  walk(target);
  return hash.digest('hex');
}
