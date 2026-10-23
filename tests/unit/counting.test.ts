import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ProjectStore } from '../../src/core/project.ts';
import { DEMO, FIXTURE_NAMES, FIXTURES, readExpected, type Expected } from '../fixtures/setup.ts';

const cases: [string, string, Expected][] = [
  ...FIXTURE_NAMES.filter((n) => fs.existsSync(path.join(FIXTURES, n, 'expected.json'))).map(
    (n) => [n, path.join(FIXTURES, n), readExpected(n)] as [string, string, Expected],
  ),
  [
    'demo-project',
    DEMO,
    JSON.parse(fs.readFileSync(path.join(FIXTURES, 'demo-expected.json'), 'utf8')) as Expected,
  ],
];

describe.each(cases)('counting: %s', (_name, root, expected) => {
  const store = new ProjectStore(root);
  const project = store.getProject();

  it('lists features in the expected order', () => {
    if (project.status !== 'OK') throw new Error('not a Spec Kit project');
    expect(project.features.map((f) => f.id)).toEqual(expected.order);
    expect(project.unrecognizedDirs).toEqual(expected.unrecognized);
    expect(project.currentFeatureId).toBe(expected.currentFeatureId);
    expect(project.constitution?.filled ?? null).toBe(expected.constitutionFilled);
  });

  for (const [id, exp] of Object.entries(expected.features)) {
    it(`${id}: tasks, checklists, clarifications and stage match the manual count`, () => {
      const f = store.getFeature(id)!;
      expect(f).toBeTruthy();
      if (exp.tasks === null) expect(f.tasks).toBeNull();
      else {
        expect([f.tasks!.total, f.tasks!.done]).toEqual([exp.tasks.total, exp.tasks.done]);
        if (exp.tasks.byPhase)
          expect(f.tasks!.byPhase.map((p) => [p.index, p.total, p.done])).toEqual(exp.tasks.byPhase);
        if (exp.tasks.byStory)
          expect(
            Object.fromEntries(f.tasks!.byStory.map((s) => [String(s.story), [s.total, s.done]])),
          ).toEqual(exp.tasks.byStory);
      }
      expect(Object.fromEntries(f.checklists.map((c) => [c.name, [c.total, c.checked]]))).toEqual(
        exp.checklists,
      );
      expect({ open: f.clarifications.open, sessions: f.clarifications.sessions }).toEqual(
        exp.clarifications,
      );
      expect(f.stage?.current).toBe(exp.stage);
      // Summary in the project list carries the same numbers.
      const summary = project.status === 'OK' ? project.features.find((s) => s.id === id) : undefined;
      expect(summary?.tasks?.done ?? null).toBe(exp.tasks?.done ?? null);
      expect(summary?.clarifications.open).toBe(exp.clarifications.open);
    });
  }
});

describe('checklist allPassed', () => {
  it('is true only when every item is checked', () => {
    const f = new ProjectStore(path.join(FIXTURES, 'basic')).getFeature('001-alpha')!;
    expect(f.checklists.find((c) => c.name === 'ux')?.allPassed).toBe(true);
    expect(f.checklists.find((c) => c.name === 'requirements')?.allPassed).toBe(false);
  });
});
