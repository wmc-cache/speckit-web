import type { FeatureSummary } from '../../../src/core/model.ts';

export type NextStepKey =
  | 'constitution'
  | 'specify'
  | 'clarify'
  | 'plan'
  | 'tasks'
  | 'checklistReview'
  | 'analyze'
  | 'implement'
  | 'review';
export function nextStep(feature: FeatureSummary, constitutionFilled: boolean): NextStepKey {
  const has = (kind: string) => feature.artifacts.some((a) => a.kind === kind && a.status === 'present');
  if (!constitutionFilled) return 'constitution';
  if (!has('spec')) return 'specify';
  if (feature.clarifications.open > 0) return 'clarify';
  if (!has('plan')) return 'plan';
  if (!has('tasks') || !feature.tasks?.total) return 'tasks';
  if (feature.checklists.some((c) => c.checked < c.total)) return 'checklistReview';
  if (feature.tasks.done === feature.tasks.total) return 'review';
  if (!feature.tasks.done) return 'analyze';
  return 'implement';
}
export function nextCommand(step: NextStepKey): string | null {
  return step === 'review' || step === 'checklistReview' ? null : `/speckit-${step}`;
}
