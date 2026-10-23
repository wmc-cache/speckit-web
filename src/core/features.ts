import { safeRead } from './safe-read.ts';
import type { ArtifactKind, ArtifactSlot, DocumentRef, NumberingKind, ScriptKind } from './model.ts';
import { ARTIFACT_KINDS } from './model.ts';

const SEQUENTIAL_RE = /^(\d{3,})-(.+)$/;
const TIMESTAMP_RE = /^(\d{8}-\d{6})-(.+)$/;

export interface FeatureName {
  id: string;
  prefix: string;
  numberingKind: NumberingKind;
  shortName: string;
}

export function parseFeatureDirName(name: string): FeatureName | null {
  // Timestamp first: `20260319-143022-x` would also match the sequential pattern.
  const ts = TIMESTAMP_RE.exec(name);
  if (ts) return { id: name, prefix: ts[1], numberingKind: 'timestamp', shortName: ts[2] };
  const seq = SEQUENTIAL_RE.exec(name);
  if (seq) return { id: name, prefix: seq[1], numberingKind: 'sequential', shortName: seq[2] };
  return null;
}

/** Sequential prefixes first (numeric ascending), then timestamps (lexicographic ascending). */
export function compareFeatures(a: FeatureName, b: FeatureName): number {
  if (a.numberingKind !== b.numberingKind) return a.numberingKind === 'sequential' ? -1 : 1;
  if (a.numberingKind === 'sequential') {
    const d = Number(a.prefix) - Number(b.prefix);
    if (d !== 0) return d;
  } else if (a.prefix !== b.prefix) {
    return a.prefix < b.prefix ? -1 : 1;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function classifyFeatureDirs(dirs: string[]): { features: FeatureName[]; unrecognized: string[] } {
  const features: FeatureName[] = [];
  const unrecognized: string[] = [];
  for (const d of dirs) {
    const f = parseFeatureDirName(d);
    if (f) features.push(f);
    else unrecognized.push(d);
  }
  features.sort(compareFeatures);
  unrecognized.sort();
  return { features, unrecognized };
}

const SINGLE_FILES: Partial<Record<string, ArtifactKind>> = {
  'spec.md': 'spec',
  'plan.md': 'plan',
  'research.md': 'research',
  'data-model.md': 'data-model',
  'quickstart.md': 'quickstart',
  'tasks.md': 'tasks',
};

/** Classify a path relative to the feature directory into a standard artifact kind. */
export function artifactKindOf(relInFeature: string): ArtifactKind | null {
  const segs = relInFeature.split('/');
  if (segs.length === 1) return SINGLE_FILES[segs[0]] ?? null;
  if (segs[0] === 'contracts') return 'contracts';
  if (segs[0] === 'checklists') return 'checklists';
  return null;
}

export function buildArtifactSlots(
  featureId: string,
  docs: DocumentRef[],
): { artifacts: ArtifactSlot[]; extraDocs: DocumentRef[] } {
  const byKind = new Map<ArtifactKind, DocumentRef[]>();
  const extraDocs: DocumentRef[] = [];
  const prefix = `specs/${featureId}/`;
  for (const d of [...docs].sort((a, b) => (a.path < b.path ? -1 : 1))) {
    const kind = artifactKindOf(d.path.slice(prefix.length));
    if (!kind) {
      extraDocs.push(d);
      continue;
    }
    const list = byKind.get(kind) ?? [];
    list.push(d);
    byKind.set(kind, list);
  }
  const artifacts = ARTIFACT_KINDS.map((kind) => {
    const list = byKind.get(kind) ?? [];
    return { kind, status: list.length ? 'present' : 'missing', docs: list } as ArtifactSlot;
  });
  return { artifacts, extraDocs };
}

function readJson(root: string, rel: string): Record<string, unknown> | null {
  try {
    return JSON.parse(safeRead(root, rel, true) ?? 'null') as Record<string, unknown>;
  } catch {
    return null;
  }
}

export interface InitOptionsInfo {
  specKitVersion: string | null;
  integration: string | null;
  script: ScriptKind | null;
  featureNumbering: NumberingKind;
}

export function readInitOptions(root: string): InitOptionsInfo {
  const j = readJson(root, '.specify/init-options.json') ?? {};
  const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
  const numbering = str(j.feature_numbering) ?? str(j.branch_numbering);
  const script = str(j.script);
  return {
    specKitVersion: str(j.speckit_version),
    integration: str(j.integration) ?? str(j.ai),
    script: script === 'sh' || script === 'ps' || script === 'py' ? script : null,
    featureNumbering: numbering === 'timestamp' ? 'timestamp' : 'sequential',
  };
}

export function readCurrentFeatureId(root: string, featureIds: string[]): string | null {
  const j = readJson(root, '.specify/feature.json');
  const dir = j && typeof j.feature_directory === 'string' ? j.feature_directory : null;
  if (!dir) return null;
  const name = dir.replace(/\\/g, '/').replace(/\/+$/, '').split('/').pop() ?? '';
  return featureIds.includes(name) ? name : null;
}
