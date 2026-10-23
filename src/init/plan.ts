import { assertTarget, targetFingerprint } from './target.ts';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { InitOptions, InitPlan, TargetState } from '../core/model.ts';
import { runSpecify, type Runner } from './runner.ts';

export const PLAN_TTL_MS = 10 * 60 * 1000;

export class InitError extends Error {
  constructor(
    readonly code: 'PREREQ_MISSING' | 'SPECIFY_FAILED' | 'INVALID_OPTIONS',
    message: string,
    readonly log?: string,
  ) {
    super(message);
  }
}

export interface PlanEntry {
  plan: InitPlan;
  options: InitOptions;
  /** Temporary directory holding the generated project. */
  staging: string;
  stagedRoot: string;
  targetPath: string;
  expiresAt: number;
  baseRoot: string;
  fingerprint: string;
}

export function resolveTarget(options: InitOptions, baseDir: string): string {
  return options.target.kind === 'here' ? path.resolve(baseDir) : path.resolve(baseDir, options.target.name);
}

export function targetStateOf(dir: string): TargetState {
  if (!fs.existsSync(dir)) return 'empty';
  if (fs.existsSync(path.join(dir, '.specify'))) return 'speckit_project';
  return fs.readdirSync(dir).length === 0 ? 'empty' : 'non_empty';
}

function listFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string, rel: string) => {
    for (const name of fs.readdirSync(dir).sort()) {
      const abs = path.join(dir, name);
      const r = rel ? `${rel}/${name}` : name;
      if (fs.lstatSync(abs).isSymbolicLink()) throw new Error('init.error.targetUnsafe');
      if (fs.statSync(abs).isDirectory()) walk(abs, r);
      else out.push(r);
    }
  };
  walk(root, '');
  return out;
}

function sameContent(a: string, b: string): boolean {
  try {
    const sa = fs.statSync(a);
    const sb = fs.statSync(b);
    return sa.isFile() && sb.isFile() && sa.size === sb.size && fs.readFileSync(a).equals(fs.readFileSync(b));
  } catch {
    return false;
  }
}

const tail = (s: string, lines = 50) => s.trimEnd().split('\n').slice(-lines).join('\n');

/**
 * Runs the official `specify init` in a temp directory and compares the result with the target.
 * Nothing is written to the target here.
 */
export async function createPlan(
  options: InitOptions,
  baseDir: string,
  runner: Runner,
  env: NodeJS.ProcessEnv = process.env,
  signal?: AbortSignal,
): Promise<{ plan: InitPlan; entry: PlanEntry }> {
  const baseRoot = fs.realpathSync(baseDir);
  const targetPath = resolveTarget(options, baseRoot);
  try {
    assertTarget(baseRoot, targetPath);
  } catch {
    throw new InitError('INVALID_OPTIONS', 'init.error.targetUnsafe');
  }
  const fingerprint = targetFingerprint(baseRoot, targetPath);
  if (fs.existsSync(targetPath) && !fs.statSync(targetPath).isDirectory())
    throw new InitError('INVALID_OPTIONS', 'init.error.targetFile');

  const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'speckit-web-init-'));
  try {
    const stagedRoot = path.join(staging, path.basename(targetPath) || 'project');
    const result = await runSpecify(
      runner,
      [
        'init',
        stagedRoot,
        '--integration',
        options.integration,
        '--script',
        options.script,
        '--ignore-agent-tools',
      ],
      { env, cwd: staging, signal },
    );
    if (result.code !== 0 || !fs.existsSync(path.join(stagedRoot, '.specify'))) {
      fs.rmSync(staging, { recursive: true, force: true });
      throw new InitError('SPECIFY_FAILED', `specify exited with code ${result.code}`, tail(result.output));
    }

    // The official CLI has no numbering flag; init-options.json is the file it reads.
    if (options.featureNumbering === 'timestamp') {
      const file = path.join(stagedRoot, '.specify', 'init-options.json');
      const json = fs.existsSync(file)
        ? (JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>)
        : {};
      json.feature_numbering = 'timestamp';
      fs.writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);
    }

    const targetState = targetStateOf(targetPath);
    const files = listFiles(stagedRoot).map((rel) => {
      const dest = path.join(targetPath, rel);
      assertTarget(baseRoot, dest);
      const action = !fs.existsSync(dest)
        ? 'create'
        : sameContent(path.join(stagedRoot, rel), dest)
          ? 'unchanged'
          : 'overwrite';
      return { path: rel, action } as InitPlan['files'][number];
    });
    const plan: InitPlan = {
      planId: crypto.randomBytes(12).toString('hex'),
      runner: { kind: runner.kind, version: runner.version },
      targetPath,
      targetState,
      files,
      requiresConfirmation: targetState !== 'empty' || files.some((f) => f.action === 'overwrite'),
    };
    return {
      plan,
      entry: {
        plan,
        options,
        staging,
        stagedRoot,
        targetPath,
        baseRoot,
        fingerprint,
        expiresAt: Date.now() + PLAN_TTL_MS,
      },
    };
  } catch (error) {
    fs.rmSync(staging, { recursive: true, force: true });
    if (error instanceof Error && error.message === 'init.error.targetUnsafe')
      throw new InitError('INVALID_OPTIONS', error.message);
    throw error;
  }
}

export function discardPlan(entry: PlanEntry): void {
  fs.rmSync(entry.staging, { recursive: true, force: true });
}

/** In-memory plans for the web wizard; expired plans are cleaned up. */
export class PlanStore {
  private plans = new Map<string, PlanEntry>();

  add(entry: PlanEntry): void {
    this.sweep();
    this.plans.set(entry.plan.planId, entry);
    const timer = setTimeout(() => this.remove(entry.plan.planId), PLAN_TTL_MS + 1000);
    timer.unref();
  }

  get(planId: string): PlanEntry | null {
    this.sweep();
    return this.plans.get(planId) ?? null;
  }

  /** Removes the plan from the store; `discard` also deletes its staging directory. */
  remove(planId: string, discard = true): void {
    const e = this.plans.get(planId);
    if (!e) return;
    this.plans.delete(planId);
    if (discard) discardPlan(e);
  }

  private sweep(): void {
    const now = Date.now();
    for (const [id, e] of this.plans) if (e.expiresAt < now) this.remove(id);
  }
}
