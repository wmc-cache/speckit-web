import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { applyPlan, InitApplyError } from '../../src/init/apply.ts';
import { createPlan, discardPlan } from '../../src/init/plan.ts';
import { detectRunner } from '../../src/init/runner.ts';
import { REPO } from '../fixtures/setup.ts';
import { fakeEnv, tmpDir } from './init-helpers.ts';

const TSX = pathToFileURL(path.join(REPO, 'node_modules/tsx/dist/loader.mjs')).href;
const options = { integration: 'claude', script: 'sh' as const, featureNumbering: 'sequential' as const };

function cli(args: string[], cwd: string, env = fakeEnv()) {
  const r = spawnSync(
    process.execPath,
    ['--import', TSX, path.join(REPO, 'src/cli/index.ts'), 'init', ...args],
    {
      cwd,
      env: { ...env, LANG: 'en_US.UTF-8', LC_ALL: '' },
      encoding: 'utf8',
      input: '',
    },
  );
  return { code: r.status, out: r.stdout + r.stderr };
}

describe('init orchestration', () => {
  it('detects the specify CLI and its version', async () => {
    const runner = await detectRunner(fakeEnv());
    expect(runner).toMatchObject({ kind: 'specify', version: '0.16.4-fake' });
    expect(await detectRunner(fakeEnv(false))).toBeNull();
  });

  it('applies directly into an empty target and cleans the staging directory', async () => {
    const base = tmpDir();
    const runner = (await detectRunner(fakeEnv()))!;
    const { plan, entry } = await createPlan(
      { ...options, target: { kind: 'new', name: 'proj' } },
      base,
      runner,
      fakeEnv(),
    );
    expect(plan.targetState).toBe('empty');
    expect(plan.requiresConfirmation).toBe(false);
    expect(plan.files.every((f) => f.action === 'create')).toBe(true);
    const result = await applyPlan(entry);
    expect(result.status).toBe('succeeded');
    expect(fs.existsSync(path.join(base, 'proj/.specify/init-options.json'))).toBe(true);
    expect(fs.existsSync(path.join(base, 'proj/.claude/skills/speckit-specify/SKILL.md'))).toBe(true);
    expect(fs.existsSync(entry.staging)).toBe(false);
  });

  it('requires confirmation for non-empty targets and existing Spec Kit projects', async () => {
    const base = tmpDir();
    fs.writeFileSync(path.join(base, 'README.md'), 'hi');
    const runner = (await detectRunner(fakeEnv()))!;
    const first = await createPlan({ ...options, target: { kind: 'here' } }, base, runner, fakeEnv());
    expect(first.plan.targetState).toBe('non_empty');
    expect(first.plan.requiresConfirmation).toBe(true);
    await applyPlan(first.entry);
    const second = await createPlan({ ...options, target: { kind: 'here' } }, base, runner, fakeEnv());
    expect(second.plan.targetState).toBe('speckit_project');
    expect(second.plan.files.every((f) => f.action === 'unchanged')).toBe(true);
    discardPlan(second.entry);
    expect(fs.existsSync(second.entry.staging)).toBe(false);
  });

  it('writes feature_numbering for the timestamp option', async () => {
    const base = tmpDir();
    const runner = (await detectRunner(fakeEnv()))!;
    const { entry } = await createPlan(
      { ...options, featureNumbering: 'timestamp', target: { kind: 'here' } },
      base,
      runner,
      fakeEnv(),
    );
    await applyPlan(entry);
    expect(
      JSON.parse(fs.readFileSync(path.join(base, '.specify/init-options.json'), 'utf8')).feature_numbering,
    ).toBe('timestamp');
  });

  it('rolls back overwritten and created files when copying fails', async () => {
    const base = tmpDir();
    fs.mkdirSync(path.join(base, '.specify/memory'), { recursive: true });
    fs.writeFileSync(path.join(base, '.specify/memory/constitution.md'), 'MY OWN CONSTITUTION');
    const runner = (await detectRunner(fakeEnv()))!;
    const { entry, plan } = await createPlan(
      { ...options, target: { kind: 'here' } },
      base,
      runner,
      fakeEnv(),
    );
    expect(plan.files.find((f) => f.path === '.specify/memory/constitution.md')?.action).toBe('overwrite');
    let copies = 0;
    const failing = (src: string, dest: string) => {
      if (++copies === 3) throw new Error('disk full');
      fs.copyFileSync(src, dest);
    };
    const err = await applyPlan(entry, { copyFile: failing }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(InitApplyError);
    expect((err as InitApplyError).rolledBack).toBe(true);
    expect(fs.readFileSync(path.join(base, '.specify/memory/constitution.md'), 'utf8')).toBe(
      'MY OWN CONSTITUTION',
    );
    expect(fs.existsSync(path.join(base, '.specify/init-options.json'))).toBe(false);
    expect(fs.existsSync(path.join(base, '.claude'))).toBe(false);
    expect(fs.existsSync(entry.staging)).toBe(false);
  });

  it('reports SPECIFY_FAILED with the end of the output and cleans up', async () => {
    const base = tmpDir();
    const env = fakeEnv(true, { SPECIFY_FAKE_FAIL: '1' });
    const runner = (await detectRunner(env))!;
    await expect(
      createPlan({ ...options, target: { kind: 'here' } }, base, runner, env),
    ).rejects.toMatchObject({
      code: 'SPECIFY_FAILED',
      log: expect.stringContaining('something went wrong'),
    });
    expect(fs.readdirSync(base)).toEqual([]);
  });
});

describe('speckit-web init (CLI)', () => {
  it('initializes a new directory non-interactively', () => {
    const base = tmpDir();
    const r = cli(['my proj', '--integration', 'claude', '--script', 'sh', '--numbering', 'timestamp'], base);
    expect(r.code, r.out).toBe(0);
    expect(r.out).toContain('Next steps');
    const opts = JSON.parse(fs.readFileSync(path.join(base, 'my proj/.specify/init-options.json'), 'utf8'));
    expect(opts).toMatchObject({ integration: 'claude', feature_numbering: 'timestamp' });
  });

  it('exits with 4 and install hints when specify and uvx are missing', () => {
    const r = cli(['x'], tmpDir(), fakeEnv(false));
    expect(r.code).toBe(4);
    expect(r.out).toContain('uv tool install specify-cli');
  });

  it('exits with 2 in non-interactive mode without [name] or --here', () => {
    expect(cli([], tmpDir()).code).toBe(2);
  });

  it('exits with 1 and prints the plan when confirmation is needed but --force is missing', () => {
    const base = tmpDir();
    fs.writeFileSync(path.join(base, 'README.md'), 'hi');
    const r = cli(['--here'], base);
    expect(r.code).toBe(1);
    expect(r.out).toContain('.specify/init-options.json');
    expect(fs.existsSync(path.join(base, '.specify'))).toBe(false);
    expect(cli(['--here', '--force'], base).code).toBe(0);
    expect(fs.existsSync(path.join(base, '.specify'))).toBe(true);
  });

  it('--dry-run --json prints the plan without writing', () => {
    const base = tmpDir();
    const r = cli(['--here', '--dry-run', '--json'], base);
    expect(r.code, r.out).toBe(0);
    const plan = JSON.parse(r.out.trim().split('\n').pop()!);
    expect(plan.files.length).toBeGreaterThan(0);
    expect(fs.readdirSync(base)).toEqual([]);
  });

  it('rejects invalid names', () => {
    expect(cli(['../evil'], tmpDir()).code).toBe(2);
    expect(cli(['..'], tmpDir()).code).toBe(2);
    expect(os.platform()).toBeTruthy();
  });
});
