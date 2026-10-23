import type { StageKey, StageState, StageStatus } from './model.ts';
import { STAGES } from './model.ts';

export interface StageInput {
  constitutionFilled: boolean;
  hasSpec: boolean;
  clarificationSessions: number;
  hasPlan: boolean;
  /** A checklist other than the auto-generated `requirements.md`. */
  hasExtraChecklist: boolean;
  hasTasks: boolean;
  tasksDone: number;
  tasksTotal: number;
}

const OPTIONAL: StageKey[] = ['clarify', 'checklist'];

/** Stage rules from data-model.md §8. */
export function computeStage(i: StageInput): StageStatus {
  const raw: Record<StageKey, StageState> = {
    constitution: i.constitutionFilled ? 'done' : 'not_started',
    specify: i.hasSpec ? 'done' : 'not_started',
    clarify: i.hasSpec && i.clarificationSessions > 0 ? 'done' : 'not_started',
    plan: i.hasPlan ? 'done' : 'not_started',
    checklist: i.hasExtraChecklist ? 'done' : 'not_started',
    tasks: i.hasTasks ? 'done' : 'not_started',
    analyze: 'optional_unknown',
    implement:
      i.hasTasks && i.tasksTotal > 0 && i.tasksDone === i.tasksTotal
        ? 'done'
        : i.hasTasks && i.tasksDone > 0
          ? 'in_progress'
          : 'not_started',
  };
  const stages = STAGES.map((key, idx) => {
    const state = raw[key];
    const laterDone = STAGES.slice(idx + 1).some((k) => raw[k] === 'done' || raw[k] === 'in_progress');
    return OPTIONAL.includes(key) && state === 'not_started' && laterDone
      ? { key, state, skipped: true }
      : { key, state };
  });
  let current: StageKey | null = null;
  for (const s of stages) if (s.state === 'done' || s.state === 'in_progress') current = s.key;
  return { stages, current };
}
