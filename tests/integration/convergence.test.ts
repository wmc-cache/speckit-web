import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { afterAll, expect, it, vi } from 'vitest';
import { ProjectStore } from '../../src/core/project.ts';
import { docIdFor } from '../../src/core/scan.ts';
import { exportSite } from '../../src/build/export.ts';
import { createPlan, discardPlan } from '../../src/init/plan.ts';
import { applyPlan, InitApplyError } from '../../src/init/apply.ts';
import { detectRunner, run } from '../../src/init/runner.ts';
import { validateOptions } from '../../src/init/options.ts';
import { fakeEnv } from './init-helpers.ts';
import { copyFixture, cleanupFixtures } from '../fixtures/setup.ts';
import { makeApp } from './helpers.ts';
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'skw-convergence-'));
afterAll(() => {
  cleanupFixtures();
  fs.rmSync(temp, { recursive: true, force: true });
});
const options = {
  target: { kind: 'here' as const },
  integration: 'claude',
  script: 'sh' as const,
  featureNumbering: 'sequential' as const,
};
async function plan() {
  const base = fs.mkdtempSync(path.join(temp, 'target-'));
  const env = fakeEnv();
  return { base, ...(await createPlan(options, base, (await detectRunner(env))!, env)) };
}
it('rejects trimmed traversal names', () => {
  for (const name of [' .. ', ' . ', '../escape'])
    expect(validateOptions({ ...options, target: { kind: 'new', name } }).ok).toBe(false);
});
it('protects reads, metadata, search and export from symlink aliases and replacements', async () => {
  const root = copyFixture('basic');
  fs.writeFileSync(path.join(root, '.env'), 'SYNTHETIC_SECRET');
  fs.symlinkSync(path.join(root, '.env'), path.join(root, 'specs/001-alpha/leak.md'));
  const outside = path.join(temp, 'outside.json');
  fs.writeFileSync(outside, JSON.stringify({ integration: 'SYNTHETIC_OUTSIDE' }));
  fs.rmSync(path.join(root, '.specify/init-options.json'), { force: true });
  fs.symlinkSync(outside, path.join(root, '.specify/init-options.json'));
  const ctx = makeApp(root);
  expect((await ctx.get('/api/project')).status).toBe(200);
  expect(ctx.store.getProject()).not.toMatchObject({ integration: 'SYNTHETIC_OUTSIDE' });
  expect(await ctx.store.getDoc(docIdFor('specs/001-alpha/leak.md'))).toBeNull();
  const id = docIdFor('specs/001-alpha/spec.md');
  await ctx.store.getDoc(id);
  fs.rmSync(path.join(root, 'specs/001-alpha/spec.md'));
  fs.symlinkSync(outside, path.join(root, 'specs/001-alpha/spec.md'));
  expect((await ctx.get(`/api/docs/${id}`)).status).toBe(404);
  expect(JSON.stringify(ctx.store.searchIndex())).not.toContain('SYNTHETIC');
  const out = path.join(temp, 'site');
  await exportSite(root, { out });
  expect(fs.readFileSync(path.join(out, 'data/search.json'), 'utf8')).not.toContain('SYNTHETIC');
});
it('rejects a target changed since preview without touching the user file', async () => {
  const { base, entry } = await plan();
  const file = entry.plan.files[0].path;
  fs.mkdirSync(path.dirname(path.join(base, file)), { recursive: true });
  fs.writeFileSync(path.join(base, file), 'USER');
  await expect(applyPlan(entry)).rejects.toMatchObject({ message: 'init.error.planChanged' });
  expect(fs.readFileSync(path.join(base, file), 'utf8')).toBe('USER');
  expect(fs.existsSync(entry.staging)).toBe(false);
});
it('rejects target symlinks introduced after preview', async () => {
  const { base, entry } = await plan();
  fs.symlinkSync(temp, path.join(base, '.specify'), 'dir');
  await expect(applyPlan(entry)).rejects.toBeInstanceOf(InitApplyError);
  expect(fs.existsSync(path.join(temp, 'init-options.json'))).toBe(false);
});
it('cleans partially copied files and reports failed directory cleanup', async () => {
  const { base, entry } = await plan();
  await expect(
    applyPlan(entry, {
      copyFile: (_s, d) => {
        fs.writeFileSync(d, 'partial');
        throw Error('disk full');
      },
    }),
  ).rejects.toMatchObject({ rolledBack: true, leftovers: [] });
  expect(fs.readdirSync(base)).toEqual([]);
  const next = await plan();
  await expect(
    applyPlan(next.entry, {
      copyFile: (_s, d) => {
        fs.writeFileSync(d, 'partial');
        throw Error('disk full');
      },
      removeDir: () => {
        throw Error('busy');
      },
    }),
  ).rejects.toMatchObject({ rolledBack: false, leftovers: expect.any(Array) });
});
it('keeps recovery backups when restoration fails', async () => {
  const first = await plan();
  await applyPlan(first.entry);
  const original = path.join(first.base, '.specify/init-options.json');
  fs.writeFileSync(original, 'USER');
  const env = fakeEnv();
  const { entry } = await createPlan(options, first.base, (await detectRunner(env))!, env);
  let error: InitApplyError | undefined;
  try {
    await applyPlan(entry, {
      copyFile: () => {
        throw Error('write');
      },
      restoreFile: () => {
        throw Error('restore');
      },
    });
  } catch (e) {
    error = e as InitApplyError;
  }
  expect(error?.rolledBack).toBe(false);
  const backup = error!.leftovers.find((p) => path.isAbsolute(p))!;
  expect(fs.readFileSync(backup, 'utf8')).toBe('USER');
  fs.rmSync(backup.slice(0, backup.indexOf(`${path.sep}.specify`)), { recursive: true, force: true });
});
it('invalidates rendered references when targets are added and removed', async () => {
  const root = copyFixture('basic');
  const file = path.join(root, 'specs/001-alpha/spec.md');
  fs.writeFileSync(file, '# Spec\n\n[New](./new.md)\n\nT999\n');
  const store = new ProjectStore(root);
  const id = docIdFor('specs/001-alpha/spec.md');
  expect((await store.getDoc(id))!.html).toContain('data-unpublished');
  fs.writeFileSync(path.join(root, 'specs/001-alpha/new.md'), '# New\n\n- [ ] T999 Task');
  store.refresh();
  expect((await store.getDoc(id))!.html).not.toContain('data-unpublished');
  expect((await store.getDoc(id))!.html).toContain('class="xref"');
  fs.rmSync(path.join(root, 'specs/001-alpha/new.md'));
  store.refresh();
  expect((await store.getDoc(id))!.html).toContain('data-unpublished');
  expect((await store.getDoc(id))!.html).not.toContain('class="xref"');
});
it('aborts child processes rather than leaving initialization running', async () => {
  const controller = new AbortController();
  const started = Date.now();
  const promise = run(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { signal: controller.signal });
  setTimeout(() => controller.abort(), 100);
  await expect(promise).rejects.toThrow('INIT_CANCELLED');
  expect(Date.now() - started).toBeLessThan(5000);
});
it('cleans staged generation when cancelled', async () => {
  const base = fs.mkdtempSync(path.join(temp, 'cancel-'));
  const env = fakeEnv();
  const controller = new AbortController();
  controller.abort();
  const created = vi.spyOn(fs, 'mkdtempSync');
  await expect(createPlan(options, base, (await detectRunner(env))!, env, controller.signal)).rejects.toThrow(
    'INIT_CANCELLED',
  );
  const staged = created.mock.results
    .filter((r) => r.type === 'return')
    .map((r) => String(r.value))
    .filter((p) => p.includes('speckit-web-init-'));
  created.mockRestore();
  expect(staged).toHaveLength(1);
  expect(fs.existsSync(staged[0])).toBe(false);
});
it('can discard a generated plan without applying it', async () => {
  const { entry } = await plan();
  discardPlan(entry);
  expect(fs.existsSync(entry.staging)).toBe(false);
});

it('cleans staging after malformed generated JSON', async () => {
  const base = fs.mkdtempSync(path.join(temp, 'badjson-'));
  const marker = path.join(base, 'marker');
  const env = fakeEnv(true, { SPECIFY_FAKE_BAD_JSON: '1', SPECIFY_FAKE_STAGE_MARKER: marker });
  await expect(
    createPlan({ ...options, featureNumbering: 'timestamp' }, base, (await detectRunner(env))!, env),
  ).rejects.toThrow();
  const staged = fs.readFileSync(marker, 'utf8');
  expect(fs.existsSync(path.dirname(staged))).toBe(false);
});

it.skipIf(process.platform === 'win32')(
  'CLI cancellation exits 130 and removes running staging',
  async () => {
    const base = fs.mkdtempSync(path.join(temp, 'cli-cancel-'));
    const marker = path.join(temp, 'running-stage');
    const child = spawn(
      process.execPath,
      [
        '--import',
        createRequire(path.resolve('package.json')).resolve('tsx'),
        path.resolve('src/cli/index.ts'),
        'init',
        'child',
        '--yes',
      ],
      {
        cwd: base,
        env: fakeEnv(true, { SPECIFY_FAKE_DELAY: '1', SPECIFY_FAKE_STAGE_MARKER: marker }),
        stdio: 'ignore',
      },
    );
    const exited = new Promise<number | null>((resolve) => child.on('exit', resolve));
    try {
      const end = Date.now() + 5000;
      while (!fs.existsSync(marker) && Date.now() < end) await new Promise((r) => setTimeout(r, 20));
      expect(fs.existsSync(marker)).toBe(true);
      child.kill('SIGINT');
      expect(await exited).toBe(130);
      expect(fs.existsSync(path.dirname(fs.readFileSync(marker, 'utf8')))).toBe(false);
      expect(fs.readdirSync(base)).toEqual([]);
    } finally {
      child.kill('SIGKILL');
    }
  },
);
