import fs from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { docIdFor, scanProject } from '../../src/core/scan.ts';
import { addHostileFiles, cleanupFixtures, copyFixture, FIXTURES } from '../fixtures/setup.ts';

afterAll(cleanupFixtures);

const paths = (root: string) => [...scanProject(root).docs.values()].map((d) => d.path).sort();

describe('scanProject', () => {
  it('registers the constitution and whitelisted files under specs/', () => {
    expect(paths(path.join(FIXTURES, 'basic'))).toEqual([
      '.specify/memory/constitution.md',
      'specs/001-alpha/checklists/requirements.md',
      'specs/001-alpha/checklists/ux.md',
      'specs/001-alpha/contracts/api.yaml',
      'specs/001-alpha/plan.md',
      'specs/001-alpha/spec.md',
      'specs/001-alpha/tasks.md',
      'specs/002-beta/spec.md',
      'specs/README.md',
      'specs/notes/ideas.md',
    ]);
  });

  it('never registers non-whitelisted extensions, other .specify files or files outside specs/', () => {
    const list = paths(path.join(FIXTURES, 'with-secrets'));
    expect(list).toEqual(['.specify/memory/constitution.md', 'specs/001-x/spec.md']);
  });

  it('skips .git, node_modules, .env* and symlinks escaping the root', () => {
    const root = copyFixture('with-secrets');
    addHostileFiles(root);
    const list = paths(root);
    expect(list).toEqual(['.specify/memory/constitution.md', 'specs/001-x/spec.md']);
    expect(list.some((p) => p.includes('leak'))).toBe(false);
  });

  it('follows symlinks that stay inside the root', () => {
    const root = copyFixture('basic');
    try {
      fs.symlinkSync(path.join(root, 'specs/002-beta/spec.md'), path.join(root, 'specs/002-beta/alias.md'));
    } catch {
      return; // symlinks unavailable
    }
    expect(paths(root)).toContain('specs/002-beta/alias.md');
  });

  it('handles Chinese characters and spaces in paths', () => {
    const scan = scanProject(path.join(FIXTURES, '中文 空格'));
    const list = [...scan.docs.values()].map((d) => d.path).sort();
    expect(list).toContain('specs/001-登录功能/plan 草稿.md');
    expect(scan.featureDirs).toEqual(['001-登录功能']);
  });

  it('uses stable ids: first 12 hex chars of the SHA-1 of the relative path', () => {
    const id = docIdFor('specs/001-alpha/spec.md');
    expect(id).toMatch(/^[0-9a-f]{12}$/);
    const scan = scanProject(path.join(FIXTURES, 'basic'));
    expect(scan.docs.get(id)?.path).toBe('specs/001-alpha/spec.md');
    expect(scanProject(path.join(FIXTURES, 'basic')).docs.has(id)).toBe(true);
  });

  it('only treats directories with .specify/ as Spec Kit projects', () => {
    const scan = scanProject(path.join(FIXTURES, 'not-speckit'));
    expect(scan.isSpecKit).toBe(false);
    expect(scan.docs.size).toBe(0);
  });

  it('accepts a project that has .specify/ but no specs/ yet', () => {
    const root = copyFixture('basic');
    fs.rmSync(path.join(root, 'specs'), { recursive: true });
    const scan = scanProject(root);
    expect(scan.isSpecKit).toBe(true);
    expect([...scan.docs.values()].map((d) => d.path)).toEqual(['.specify/memory/constitution.md']);
  });
});
