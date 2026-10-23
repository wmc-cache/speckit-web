import fs from 'node:fs';
import path from 'node:path';

const extensions = new Set(['.md', '.yaml', '.yml', '.json', '.graphql', '.proto', '.txt']);
const metadata = new Set(['.specify/init-options.json', '.specify/feature.json']);
export function allowedPath(rel: string, config = false): boolean {
  const parts = rel.split('/');
  if (parts.some((p) => p === '..' || p === '.git' || p === 'node_modules' || p.startsWith('.env')))
    return false;
  return config
    ? metadata.has(rel)
    : rel === '.specify/memory/constitution.md' ||
        (parts[0] === 'specs' && extensions.has(path.posix.extname(rel).toLowerCase()));
}

/** Validate both the public name and its resolved target, including metadata. */
export function safeFile(root: string, rel: string, config = false): string | null {
  try {
    const base = fs.realpathSync(root);
    const real = fs.realpathSync(path.resolve(base, rel));
    const target = path.relative(base, real).split(path.sep).join('/');
    if (!allowedPath(rel, config) || !allowedPath(target, config) || path.isAbsolute(target)) return null;
    return fs.statSync(real).isFile() ? real : null;
  } catch {
    return null;
  }
}

export function safeRead(root: string, rel: string, config = false): string | null {
  let fd: number | undefined;
  try {
    const real = safeFile(root, rel, config);
    if (!real) return null;
    fd = fs.openSync(real, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
    const opened = fs.fstatSync(fd);
    const checked = safeFile(root, rel, config);
    if (checked !== real) return null;
    const current = fs.statSync(checked);
    if (!opened.isFile() || current.dev !== opened.dev || current.ino !== opened.ino) return null;
    return fs.readFileSync(fd, 'utf8');
  } catch {
    return null;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}
