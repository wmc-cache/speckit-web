import { expect, it } from 'vitest';
import { ProjectStore } from '../../src/core/project.ts';
import { DEMO } from '../fixtures/setup.ts';
import { nextStep, nextCommand } from '../../web/src/lib/next-step.ts';
const store = new ProjectStore(DEMO);
it('recommends plan for spec-only features, and clarification before continuing implementation', () => {
  expect(nextStep(store.getFeature('001-team-calendar')!, true)).toBe('plan');
  expect(nextStep(store.getFeature('002-user-login')!, true)).toBe('clarify');
  expect(nextStep(store.getFeature('003-notification-center')!, true)).toBe('tasks');
});
it('prioritizes prerequisites, outstanding reviews and honest completion guidance', () => {
  const f = structuredClone(store.getFeature('002-user-login')!);
  expect(nextStep(f, false)).toBe('constitution');
  f.clarifications.open = 0;
  expect(nextStep(f, true)).toBe('implement');
  f.checklists[0].checked = 0;
  expect(nextStep(f, true)).toBe('checklistReview');
  f.checklists[0].checked = f.checklists[0].total;
  f.tasks!.done = 0;
  expect(nextStep(f, true)).toBe('analyze');
  f.tasks!.done = f.tasks!.total;
  expect(nextStep(f, true)).toBe('review');
  expect(nextCommand('review')).toBeNull();
  f.tasks!.total = 0;
  expect(nextStep(f, true)).toBe('tasks');
  f.artifacts.find((a) => a.kind === 'spec')!.status = 'missing';
  expect(nextStep(f, true)).toBe('specify');
});
