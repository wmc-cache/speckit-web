// Shared types — one-to-one with specs/001-speckit-web-scaffold/data-model.md.
// Used by the Node side (core/server/build/init) and by the web app.

export type ViewMode = 'local' | 'static';
export type NumberingKind = 'sequential' | 'timestamp';
export type ScriptKind = 'sh' | 'ps' | 'py';

export const ARTIFACT_KINDS = [
  'spec',
  'plan',
  'research',
  'data-model',
  'contracts',
  'quickstart',
  'tasks',
  'checklists',
] as const;
export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];

export type DocKind = 'constitution' | ArtifactKind | 'other';
export type DocFormat = 'markdown' | 'yaml' | 'json' | 'text';

export interface DocumentRef {
  id: string;
  path: string;
  title: string;
  kind: DocKind;
  updatedAt: string;
}

export interface Heading {
  depth: number;
  text: string;
  anchor: string;
}

export interface ClarificationMark {
  anchor: string;
  text: string;
}

export interface DocumentData extends DocumentRef {
  featureId: string | null;
  format: DocFormat;
  html: string;
  outline: Heading[];
  anchors: Record<string, string>;
  clarificationMarks: ClarificationMark[];
  size: number;
  truncated: boolean;
  parts: number;
  anchorParts: Record<string, number>;
  part: number;
}

export interface ArtifactSlot {
  kind: ArtifactKind;
  status: 'present' | 'missing';
  docs: DocumentRef[];
}

export interface Constitution {
  docId: string;
  filled: boolean;
  title: string | null;
  version: string | null;
  ratified: string | null;
  lastAmended: string | null;
}

export interface Task {
  id: string | null;
  text: string;
  done: boolean;
  parallel: boolean;
  story: string | null;
  phase: { index: number; title: string } | null;
  anchor: string | null;
}

export interface TaskStats {
  docId: string;
  total: number;
  done: number;
  byPhase: { index: number; title: string; total: number; done: number }[];
  byStory: { story: string | null; total: number; done: number }[];
}

export interface ChecklistStats {
  docId: string;
  name: string;
  total: number;
  checked: number;
  allPassed: boolean;
}

export interface SpecSummary {
  stories: { index: number; title: string; priority: string | null; anchor: string }[];
  requirements: { id: string; anchor: string; text: string }[];
  successCriteria: { id: string; anchor: string; text: string }[];
}

export const STAGES = [
  'constitution',
  'specify',
  'clarify',
  'plan',
  'checklist',
  'tasks',
  'analyze',
  'implement',
] as const;
export type StageKey = (typeof STAGES)[number];
export type StageState = 'done' | 'in_progress' | 'not_started' | 'optional_unknown';

export interface StageStatus {
  stages: { key: StageKey; state: StageState; skipped?: boolean }[];
  current: StageKey | null;
}

export interface FeatureSummary {
  id: string;
  prefix: string;
  numberingKind: NumberingKind;
  shortName: string;
  title: string;
  artifacts: ArtifactSlot[];
  extraDocs: DocumentRef[];
  stage: StageStatus | null;
  tasks: TaskStats | null;
  checklists: ChecklistStats[];
  clarifications: { open: number; sessions: number; specDocId: string | null; marks: ClarificationMark[] };
  updatedAt: string;
}

export interface Feature extends FeatureSummary {
  specSummary: SpecSummary | null;
  taskItems: Task[];
}

export interface Project {
  name: string;
  mode: ViewMode;
  specKitVersion: string | null;
  integration: string | null;
  script: ScriptKind | null;
  featureNumbering: NumberingKind;
  currentFeatureId: string | null;
  constitution: Constitution | null;
  features: FeatureSummary[];
  unrecognizedDirs: string[];
  generatedAt: string;
}

export type ProjectResponse =
  | ({ status: 'OK' } & Project)
  | { status: 'NOT_SPECKIT_PROJECT'; name: string; canInit: boolean; mode: ViewMode };

export interface SearchIndexEntry {
  docId: string;
  featureId: string | null;
  featureOrder: number;
  title: string;
  path: string;
  text: string;
  headings: { offset: number; anchor: string; text: string }[];
}

export interface SearchHit {
  docId: string;
  featureId: string | null;
  title: string;
  path: string;
  anchor: string | null;
  snippet: string;
  score: number;
}

export interface SearchResult {
  query: string;
  hits: SearchHit[];
  total: number;
}

export type InitTarget = { kind: 'here' } | { kind: 'new'; name: string };

export interface InitOptions {
  target: InitTarget;
  integration: string;
  script: ScriptKind;
  featureNumbering: NumberingKind;
}

export type TargetState = 'empty' | 'non_empty' | 'speckit_project';

export interface InitPlan {
  planId: string;
  runner: { kind: 'specify' | 'uvx'; version: string | null };
  targetPath: string;
  targetState: TargetState;
  files: { path: string; action: 'create' | 'overwrite' | 'unchanged' }[];
  requiresConfirmation: boolean;
}

export interface IntegrationInfo {
  key: string;
  name: string;
  requiresCli: boolean;
}

export interface ChangeEvent {
  type: 'project' | 'document' | 'removed';
  docIds: string[];
  at: string;
}

export type ErrorCode =
  | 'NOT_SPECKIT_PROJECT'
  | 'FORBIDDEN_HOST'
  | 'BAD_TOKEN'
  | 'FEATURE_NOT_FOUND'
  | 'DOC_NOT_FOUND'
  | 'EMPTY_QUERY'
  | 'INVALID_OPTIONS'
  | 'PREREQ_MISSING'
  | 'SPECIFY_FAILED'
  | 'PLAN_EXPIRED'
  | 'CONFIRMATION_REQUIRED'
  | 'APPLY_FAILED';

export interface ApiError {
  error: ErrorCode;
  message: string;
  [extra: string]: unknown;
}
