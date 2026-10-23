import fs from 'node:fs';
import path from 'node:path';

/** Generates a Spec Kit project with `features` features and `docs` documents in total. */
export function generateProject(root: string, features = 50, docs = 500): void {
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(path.join(root, '.specify/memory'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '.specify/memory/constitution.md'),
    '# Perf Constitution\n\n**Version**: 1.0.0 | **Ratified**: 2026-01-01 | **Last Amended**: 2026-01-01\n',
  );
  const perFeature = Math.floor((docs - 1) / features);
  const para = (i: number) =>
    `Paragraph ${i} describes requirement FR-${String((i % 20) + 1).padStart(3, '0')} with some realistic prose about the system, its users and the expected behaviour under load. `.repeat(
      4,
    );
  for (let f = 1; f <= features; f++) {
    const dir = path.join(root, 'specs', `${String(f).padStart(3, '0')}-feature-${f}`);
    fs.mkdirSync(path.join(dir, 'checklists'), { recursive: true });
    const spec = [`# Feature Specification: Feature ${f}`, '', '## Requirements', ''];
    for (let r = 1; r <= 20; r++)
      spec.push(`- **FR-${String(r).padStart(3, '0')}**: System MUST handle case ${r} for feature ${f}.`);
    for (let s = 0; s < 40; s++) spec.push('', `## Section ${s}`, '', para(s));
    fs.writeFileSync(path.join(dir, 'spec.md'), spec.join('\n'));
    const tasks = ['# Tasks', '', '## Phase 1: Setup', ''];
    for (let t = 1; t <= 60; t++)
      tasks.push(
        `- [${t % 3 ? ' ' : 'x'}] T${String(t).padStart(3, '0')} [US${(t % 3) + 1}] Implement step ${t} for FR-00${(t % 9) + 1}`,
      );
    fs.writeFileSync(path.join(dir, 'tasks.md'), tasks.join('\n'));
    for (let d = 2; d < perFeature; d++) {
      const body = [`# Note ${d} of feature ${f}`, '', '```ts', 'const x = 1;', '```'];
      for (let s = 0; s < 15; s++) body.push('', `## Part ${s}`, '', para(s));
      if (f === 42 && d === 5) body.push('', 'The unique needle word zanzibar appears only here.');
      fs.writeFileSync(path.join(dir, d % 2 ? `checklists/c${d}.md` : `note-${d}.md`), body.join('\n'));
    }
  }
}
