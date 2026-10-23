import spawn from 'cross-spawn';
import fs from 'node:fs';
import path from 'node:path';

export const SPEC_KIT_REPO = 'git+https://github.com/github/spec-kit.git';

export interface Runner {
  kind: 'specify' | 'uvx';
  /** Executable to spawn. */
  command: string;
  /** Arguments placed before the specify sub-command. */
  prefix: string[];
  version: string | null;
}

export interface RunResult {
  code: number;
  output: string;
}

// eslint-disable-next-line no-control-regex -- matching ANSI escape sequences is the point
const ANSI_RE = /\x1b\[[0-9;?]*[ -/]*[@-~]/g;

/** Locate an executable on PATH (honours PATHEXT on Windows). */
export function which(cmd: string, env: NodeJS.ProcessEnv = process.env): string | null {
  const pathVar = env.PATH ?? env.Path ?? '';
  const exts = process.platform === 'win32' ? (env.PATHEXT ?? '.EXE;.CMD;.BAT').split(';') : [''];
  for (const dir of pathVar.split(path.delimiter).filter(Boolean)) {
    for (const ext of exts) {
      const file = path.join(dir, cmd + ext.toLowerCase());
      const fileUpper = path.join(dir, cmd + ext);
      for (const f of new Set([file, fileUpper])) {
        try {
          const st = fs.statSync(f);
          if (st.isFile() && (process.platform === 'win32' || (st.mode & 0o111) !== 0)) return f;
        } catch {
          // not here
        }
      }
    }
  }
  return null;
}

export function run(
  command: string,
  args: string[],
  opts: { env?: NodeJS.ProcessEnv; cwd?: string; signal?: AbortSignal } = {},
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    if (opts.signal?.aborted) {
      reject(new Error('INIT_CANCELLED'));
      return;
    }
    const child = spawn(command, args, {
      cwd: opts.cwd,
      env: { ...(opts.env ?? process.env), NO_COLOR: '1', TERM: 'dumb', PYTHONIOENCODING: 'utf-8' },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    });
    let output = '';
    const cancel = () => {
      if (!child.pid) return;
      if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F']);
      else {
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch {
          child.kill('SIGKILL');
        }
      }
    };
    opts.signal?.addEventListener('abort', cancel, { once: true });

    child.stdout?.on('data', (d: Buffer) => (output += d.toString()));
    child.stderr?.on('data', (d: Buffer) => (output += d.toString()));
    child.on('error', (err) => resolve({ code: 127, output: output + String(err) }));
    child.on('close', (code) => {
      opts.signal?.removeEventListener('abort', cancel);
      if (opts.signal?.aborted) reject(new Error('INIT_CANCELLED'));
      else resolve({ code: code ?? 1, output: output.replace(ANSI_RE, '') });
    });
  });
}

export function parseVersion(output: string): string | null {
  return /CLI Version\s+([\w.+-]+)/.exec(output.replace(ANSI_RE, ''))?.[1] ?? null;
}

/** Prefer `specify` on PATH; fall back to `uvx --from <spec-kit> specify` (needs network on first use). */
export async function detectRunner(env: NodeJS.ProcessEnv = process.env): Promise<Runner | null> {
  const specify = which('specify', env);
  if (specify) {
    const r = await run(specify, ['version'], { env });
    return { kind: 'specify', command: specify, prefix: [], version: parseVersion(r.output) };
  }
  const uvx = which('uvx', env);
  if (uvx) return { kind: 'uvx', command: uvx, prefix: ['--from', SPEC_KIT_REPO, 'specify'], version: null };
  return null;
}

export function runSpecify(
  runner: Runner,
  args: string[],
  opts: { env?: NodeJS.ProcessEnv; cwd?: string; signal?: AbortSignal } = {},
) {
  return run(runner.command, [...runner.prefix, ...args], opts);
}

export interface InstallHint {
  uv: string;
  specify: string;
}

export function installHint(platform: NodeJS.Platform = process.platform): InstallHint {
  return {
    uv:
      platform === 'win32'
        ? 'powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"'
        : 'curl -LsSf https://astral.sh/uv/install.sh | sh',
    specify: `uv tool install specify-cli --from ${SPEC_KIT_REPO}`,
  };
}
