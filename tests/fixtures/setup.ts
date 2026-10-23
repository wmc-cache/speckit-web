import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const FIXTURES = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(FIXTURES, '../..');
export const DEMO = path.join(REPO, 'examples', 'demo-project');
export const FIXTURE_NAMES = ['basic', 'timestamp-numbering', 'unfilled-constitution', '中文 空格', 'with-secrets'] as const;

const created: string[] = [];

/** Copy a fixture into a fresh temp dir (tests may modify it freely). */
export function copyFixture(name: string, parent = fs.mkdtempSync(path.join(os.tmpdir(), 'skw-'))): string {
  const dest = path.join(parent, name);
  fs.cpSync(path.join(FIXTURES, name), dest, { recursive: true });
  fs.rmSync(path.join(dest, 'expected.json'), { force: true });
  created.push(parent);
  return dest;
}

export function copyDemo(): string {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'skw-demo-'));
  const dest = path.join(parent, 'demo-project');
  fs.cpSync(DEMO, dest, { recursive: true });
  created.push(parent);
  return dest;
}

export function readExpected(name: string): Expected {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, name, 'expected.json'), 'utf8')) as Expected;
}

export interface Expected {
  order: string[];
  unrecognized: string[];
  currentFeatureId: string | null;
  constitutionFilled: boolean | null;
  features: Record<
    string,
    {
      tasks: null | {
        total: number;
        done: number;
        byPhase?: [number, number, number][];
        byStory?: Record<string, [number, number]>;
      };
      checklists: Record<string, [number, number]>;
      clarifications: { open: number; sessions: number };
      stage: string;
    }
  >;
}

/**
 * Adds the things that cannot live in git: `.git/`, `.env`, `node_modules/`, a symlink escaping
 * the project root and a symlinked directory pointing outside. Returns the outside secret path.
 */
export function addHostileFiles(root: string): { outsideFile: string } {
  const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skw-outside-'));
  created.push(outsideDir);
  const outsideFile = path.join(outsideDir, 'secret.md');
  fs.writeFileSync(outsideFile, '# TOP SECRET outside the project\n');
  const feature = path.join(root, 'specs', fs.readdirSync(path.join(root, 'specs')).find((d) => /^\d/.test(d))!);
  fs.mkdirSync(path.join(root, '.git'), { recursive: true });
  fs.writeFileSync(path.join(root, '.git', 'config'), '[core]\n');
  fs.mkdirSync(path.join(root, 'specs', '.git'), { recursive: true });
  fs.writeFileSync(path.join(root, 'specs', '.git', 'HEAD.md'), '# git internals\n');
  fs.writeFileSync(path.join(feature, '.env'), 'TOKEN=abc\n');
  fs.writeFileSync(path.join(feature, '.env.md'), '# env as markdown\n');
  fs.mkdirSync(path.join(feature, 'node_modules'), { recursive: true });
  fs.writeFileSync(path.join(feature, 'node_modules', 'dep.md'), '# dependency\n');
  try {
    fs.symlinkSync(outsideFile, path.join(feature, 'leak.md'));
    fs.symlinkSync(outsideDir, path.join(feature, 'leak-dir'), 'dir');
  } catch {
    // Symlinks may be unavailable (e.g. Windows without developer mode); the tests skip those checks.
  }
  return { outsideFile };
}

/** Writes a Markdown document larger than `bytes`. */
export function writeBigDoc(file: string, bytes = 1.5 * 1024 * 1024): void {
  const line = '- [ ] T100 A long line of task text that repeats to make the document very large indeed.\n';
  const lines = ['# Big document\n\n', '## Part A\n\n'];
  let size = 0;
  while (size < bytes) {
    lines.push(line);
    size += line.length;
  }
  fs.writeFileSync(file, lines.join(''));
}

export function cleanupFixtures(): void {
  for (const dir of created.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
}
