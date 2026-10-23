import { describe, expect, it } from 'vitest';
import type { StageKey, StageState } from '../../src/core/model.ts';
import { computeStage, type StageInput } from '../../src/core/stage.ts';

const base: StageInput = {
  constitutionFilled: false,
  hasSpec: false,
  clarificationSessions: 0,
  hasPlan: false,
  hasExtraChecklist: false,
  hasTasks: false,
  tasksDone: 0,
  tasksTotal: 0,
};

const states = (input: Partial<StageInput>) =>
  Object.fromEntries(
    computeStage({ ...base, ...input }).stages.map((s) => [s.key, s.skipped ? 'skipped' : s.state]),
  ) as Record<StageKey, StageState | 'skipped'>;

describe('computeStage', () => {
  it('nothing generated yet', () => {
    const r = computeStage(base);
    expect(r.current).toBeNull();
    expect(states({}).analyze).toBe('optional_unknown');
  });

  it('constitution is done when filled', () => {
    expect(states({ constitutionFilled: true }).constitution).toBe('done');
    expect(computeStage({ ...base, constitutionFilled: true }).current).toBe('constitution');
  });

  it('spec only → current stage is specify, later stages not started', () => {
    const s = states({ hasSpec: true });
    expect(s).toMatchObject({
      specify: 'done',
      clarify: 'not_started',
      plan: 'not_started',
      tasks: 'not_started',
      implement: 'not_started',
    });
    expect(computeStage({ ...base, hasSpec: true }).current).toBe('specify');
  });

  it('clarify is done when a Clarifications session exists', () => {
    expect(states({ hasSpec: true, clarificationSessions: 1 }).clarify).toBe('done');
    expect(computeStage({ ...base, hasSpec: true, clarificationSessions: 1 }).current).toBe('clarify');
  });

  it('optional clarify/checklist are marked skipped once a later stage is done', () => {
    const s = states({ hasSpec: true, hasPlan: true, hasTasks: true, tasksTotal: 3 });
    expect(s.clarify).toBe('skipped');
    expect(s.checklist).toBe('skipped');
    expect(s.plan).toBe('done');
    expect(s.tasks).toBe('done');
  });

  it('checklist is done only with checklists other than requirements.md', () => {
    expect(states({ hasSpec: true, hasPlan: true, hasExtraChecklist: true }).checklist).toBe('done');
  });

  it('implement: in progress with some tasks checked, done when all are checked', () => {
    expect(states({ hasSpec: true, hasTasks: true, tasksTotal: 4, tasksDone: 1 }).implement).toBe(
      'in_progress',
    );
    expect(
      computeStage({ ...base, hasSpec: true, hasTasks: true, tasksTotal: 4, tasksDone: 1 }).current,
    ).toBe('implement');
    expect(states({ hasSpec: true, hasTasks: true, tasksTotal: 4, tasksDone: 4 }).implement).toBe('done');
    expect(states({ hasSpec: true, hasTasks: true, tasksTotal: 0, tasksDone: 0 }).implement).toBe(
      'not_started',
    );
    expect(computeStage({ ...base, hasSpec: true, hasTasks: true, tasksTotal: 4 }).current).toBe('tasks');
  });

  it('analyze is always optional_unknown and never the current stage', () => {
    const r = computeStage({
      ...base,
      hasSpec: true,
      hasPlan: true,
      hasTasks: true,
      tasksTotal: 2,
      tasksDone: 2,
    });
    expect(r.stages.find((s) => s.key === 'analyze')?.state).toBe('optional_unknown');
    expect(r.current).toBe('implement');
  });
});
