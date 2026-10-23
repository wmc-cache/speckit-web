import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { exportSite } from '../../src/build/export.ts';
import { CliError } from '../../src/cli/exit-codes.ts';
import { addHostileFiles, cleanupFixtures, copyFixture, FIXTURES } from '../fixtures/setup.ts';
import { ensureWebRoot } from './helpers.ts';

afterAll(cleanupFixtures);
ensureWebRoot();

function listFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const n of fs.readdirSync(d)) {
      const p = path.join(d, n);
      if (fs.statSync(p).isDirectory()) walk(p);
      else out.push(path.relative(dir, p).split(path.sep).join('/'));
    }
  };
  walk(dir);
  return out.sort();
}

describe('static export', () => {
  it('writes the structure from contracts/static-site.md', async () => {
    const root = copyFixture('basic');
    const out = path.join(os.tmpdir(), `skw-site-${Date.now()}`);
    const summary = await exportSite(root, { out });
    expect(summary.features).toBe(2);
    const files = listFiles(out);
    expect(files).toContain('index.html');
    expect(files).toContain('.nojekyll');
    expect(files).toContain('.speckit-web-build');
    expect(files).toContain('data/project.json');
    expect(files).toContain('data/features/001-alpha.json');
    expect(files).toContain('data/search.json');
    expect(files.filter((f) => f.startsWith('data/docs/')).length).toBe(summary.documents);
    expect(fs.readFileSync(path.join(out, 'index.html'), 'utf8')).toContain('content="static"');
    expect(JSON.parse(fs.readFileSync(path.join(out, 'data/project.json'), 'utf8')).mode).toBe('static');
    fs.rmSync(out, { recursive: true });
  });

  it('contains no absolute paths, home directory or non-whitelisted content', async () => {
    const root = copyFixture('with-secrets');
    addHostileFiles(root);
    const out = path.join(root, 'speckit-site');
    await exportSite(root, {});
    const all = listFiles(out)
      .map((f) => fs.readFileSync(path.join(out, f), 'utf8'))
      .join('\n');
    expect(all).not.toContain(os.homedir());
    expect(all).not.toContain(root);
    expect(all).not.toContain('do-not-leak');
    expect(all).not.toContain('TOP SECRET');
    expect(all).not.toContain('TOKEN=abc');
  });

  it('is deterministic apart from the build marker and generatedAt', async () => {
    const root = copyFixture('basic');
    const a = path.join(os.tmpdir(), `skw-a-${Date.now()}`);
    const b = path.join(os.tmpdir(), `skw-b-${Date.now()}`);
    await exportSite(root, { out: a });
    await new Promise((r) => setTimeout(r, 20));
    await exportSite(root, { out: b });
    for (const f of listFiles(a)) {
      if (f === '.speckit-web-build') continue;
      const strip = (s: string) => s.replace(/"generatedAt":"[^"]+"/g, '');
      expect(strip(fs.readFileSync(path.join(b, f), 'utf8')), f).toBe(
        strip(fs.readFileSync(path.join(a, f), 'utf8')),
      );
    }
    fs.rmSync(a, { recursive: true });
    fs.rmSync(b, { recursive: true });
  });

  it('fails with exit code 3 for non Spec Kit directories', async () => {
    await expect(
      exportSite(path.join(FIXTURES, 'not-speckit'), { out: path.join(os.tmpdir(), 'skw-x') }),
    ).rejects.toMatchObject({
      code: 3,
    });
  });

  it('refuses to clear an existing output directory without the build marker', async () => {
    const root = copyFixture('basic');
    const out = path.join(root, 'precious');
    fs.mkdirSync(out);
    fs.writeFileSync(path.join(out, 'keep.txt'), 'keep');
    await expect(exportSite(root, { out })).rejects.toBeInstanceOf(CliError);
    expect(fs.readFileSync(path.join(out, 'keep.txt'), 'utf8')).toBe('keep');
    // A second build into a directory it created itself is allowed.
    const own = path.join(root, 'site');
    await exportSite(root, { out: own });
    await exportSite(root, { out: own });
  });

  it('the CLI build command prints a JSON summary', () => {
    const root = copyFixture('basic');
    const stdout = execFileSync(
      process.execPath,
      ['--import', 'tsx', 'src/cli/index.ts', 'build', root, '--json'],
      {
        cwd: path.resolve(FIXTURES, '../..'),
        encoding: 'utf8',
      },
    );
    const j = JSON.parse(stdout);
    expect(j).toMatchObject({ features: 2 });
    expect(j.out).toBe(path.join(root, 'speckit-site'));
  });
});
