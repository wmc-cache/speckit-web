import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { discardPlan, type PlanEntry } from './plan.ts';

export class InitApplyError extends Error {
  constructor(
    message: string,
    readonly rolledBack: boolean,
    readonly leftovers: string[],
  ) {
    super(message);
  }
}

export interface ApplyResult {
  status: 'succeeded';
  targetPath: string;
  written: number;
}

export interface ApplyOptions {
  /** Injected for tests; defaults to fs.copyFileSync (which keeps file modes). */
  copyFile?: (src: string, dest: string) => void;
}

/**
 * Copies the staged project into the target. Files that would be overwritten are backed up first;
 * any failure restores them and deletes newly created files and directories. Staging and backups are
 * always removed.
 */
export async function applyPlan(entry: PlanEntry, opts: ApplyOptions = {}): Promise<ApplyResult> {
  const copy = opts.copyFile ?? ((s: string, d: string) => fs.copyFileSync(s, d));
  const { stagedRoot, targetPath, plan } = entry;
  const backup = fs.mkdtempSync(path.join(os.tmpdir(), 'speckit-web-backup-'));
  const createdFiles: string[] = [];
  const createdDirs: string[] = [];
  const backedUp: string[] = [];

  const mkdirp = (dir: string) => {
    const missing: string[] = [];
    let d = dir;
    while (!fs.existsSync(d)) {
      missing.unshift(d);
      d = path.dirname(d);
    }
    for (const m of missing) {
      fs.mkdirSync(m);
      createdDirs.push(m);
    }
  };

  try {
    mkdirp(targetPath);
    for (const f of plan.files.filter((x) => x.action === 'overwrite')) {
      const dest = path.join(backup, f.path);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(path.join(targetPath, f.path), dest);
      backedUp.push(f.path);
    }
    let written = 0;
    for (const f of plan.files) {
      if (f.action === 'unchanged') continue;
      const dest = path.join(targetPath, f.path);
      mkdirp(path.dirname(dest));
      copy(path.join(stagedRoot, f.path), dest);
      if (f.action === 'create') createdFiles.push(dest);
      written++;
    }
    return { status: 'succeeded', targetPath, written };
  } catch (err) {
    const leftovers: string[] = [];
    for (const rel of backedUp) {
      try {
        fs.copyFileSync(path.join(backup, rel), path.join(targetPath, rel));
      } catch {
        leftovers.push(rel);
      }
    }
    for (const file of createdFiles) {
      try {
        fs.rmSync(file, { force: true });
      } catch {
        leftovers.push(path.relative(targetPath, file));
      }
    }
    for (const dir of [...createdDirs].reverse()) {
      try {
        fs.rmdirSync(dir);
      } catch {
        // not empty or already gone
      }
    }
    throw new InitApplyError(
      err instanceof Error ? err.message : String(err),
      leftovers.length === 0,
      leftovers,
    );
  } finally {
    fs.rmSync(backup, { recursive: true, force: true });
    discardPlan(entry);
  }
}

export function nextSteps(dirLabel: string | null): { key: string; vars?: Record<string, string> }[] {
  return [
    ...(dirLabel ? [{ key: 'init.next.cd', vars: { dir: dirLabel } }] : []),
    { key: 'init.next.constitution' },
    { key: 'init.next.specify' },
    { key: 'init.next.view' },
  ];
}
