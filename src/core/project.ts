import fs from 'node:fs';
import path from 'node:path';
import type {
  ChangeEvent,
  SearchIndexEntry,
  DocKind,
  DocumentData,
  DocumentRef,
  Feature,
  FeatureSummary,
  Project,
  ProjectResponse,
  ViewMode,
} from './model.ts';
import {
  artifactKindOf,
  buildArtifactSlots,
  classifyFeatureDirs,
  readCurrentFeatureId,
  readInitOptions,
  type FeatureName,
} from './features.ts';
import { parseChecklist } from './parse/checklists.ts';
import { parseConstitution } from './parse/constitution.ts';
import { analyzeSpec } from './parse/spec-summary.ts';
import { parseTasks } from './parse/tasks.ts';
import { asMarkdownSource, renderMarkdown, splitParts } from './render/index.ts';
import { docHref } from './render/links.ts';
import { rehypeClarificationMarks } from './render/speckit-marks.ts';
import { rehypeXref } from './render/xref.ts';
import { assignDefinitionAnchors } from './markdown/ids.ts';
import { parseMarkdown } from './markdown/ast.ts';
import { buildSearchText } from './search-build.ts';
import { computeStage } from './stage.ts';
import { CONSTITUTION_PATH, scanProject, type DocEntry, type ScanResult } from './scan.ts';

const H1_RE = /^#[ \t]+(.+?)[ \t]*#*[ \t]*$/m;
const FEATURE_TITLE_PREFIX = /^Feature Specification:\s*/i;

export interface ProjectStoreOptions {
  mode?: ViewMode;
  /** Overrides the display name (defaults to the root directory name). */
  title?: string;
}

interface CachedText {
  mtimeMs: number;
  size: number;
  text: string;
}

export class ProjectStore {
  readonly mode: ViewMode;
  root: string;
  private title?: string;
  private scan!: ScanResult;
  private texts = new Map<string, CachedText>();
  private rendered = new Map<string, { mtimeMs: number; data: DocumentData }>();
  private analyses = new Map<string, { mtimeMs: number; value: unknown }>();
  private features = new Map<string, Feature>();
  private featureOrder: FeatureName[] = [];
  private project: Project | null = null;
  private generatedAt = new Date().toISOString();

  constructor(root: string, opts: ProjectStoreOptions = {}) {
    this.root = path.resolve(root);
    this.mode = opts.mode ?? 'local';
    this.title = opts.title;
    this.load();
  }

  get isSpecKit(): boolean {
    return this.scan.isSpecKit;
  }

  get name(): string {
    return this.title ?? path.basename(this.root);
  }

  /** Switch to another root (used after initializing a new sub-directory). */
  setRoot(root: string): void {
    this.root = path.resolve(root);
    this.title = undefined;
    this.texts.clear();
    this.rendered.clear();
    this.analyses.clear();
    this.load();
  }

  load(): void {
    this.scan = scanProject(this.root);
    this.generatedAt = new Date().toISOString();
    this.build();
  }

  /** Rescan and report what changed since the previous scan. */
  refresh(): ChangeEvent[] {
    const before = this.scan.docs;
    const prevProject = JSON.stringify(this.projectFingerprint());
    this.scan = scanProject(this.root);
    const after = this.scan.docs;
    const removed: string[] = [];
    const changed: string[] = [];
    for (const [id, e] of before) {
      const n = after.get(id);
      if (!n) removed.push(id);
      else if (n.mtimeMs !== e.mtimeMs || n.size !== e.size) changed.push(id);
    }
    const added = [...after.keys()].filter((id) => !before.has(id));
    for (const id of [...removed, ...changed]) {
      this.texts.delete(id);
      for (const key of this.rendered.keys()) if (key.startsWith(`${id}:`)) this.rendered.delete(key);
    }
    this.build();
    const at = new Date().toISOString();
    const events: ChangeEvent[] = [];
    const projectChanged =
      removed.length > 0 ||
      added.length > 0 ||
      changed.length > 0 ||
      JSON.stringify(this.projectFingerprint()) !== prevProject;
    if (projectChanged) {
      this.generatedAt = at;
      events.push({ type: 'project', docIds: [...added, ...removed, ...changed], at });
    }
    if (changed.length) events.push({ type: 'document', docIds: changed, at });
    if (removed.length) events.push({ type: 'removed', docIds: removed, at });
    return events;
  }

  private projectFingerprint() {
    return {
      isSpecKit: this.scan?.isSpecKit,
      init: readInitOptions(this.root),
      cur: this.project?.currentFeatureId,
    };
  }

  entry(docId: string): DocEntry | undefined {
    return this.scan.docs.get(docId);
  }

  entries(): DocEntry[] {
    return [...this.scan.docs.values()];
  }

  readText(docId: string): string | null {
    const e = this.scan.docs.get(docId);
    if (!e) return null;
    const cached = this.texts.get(docId);
    if (cached && cached.mtimeMs === e.mtimeMs && cached.size === e.size) return cached.text;
    try {
      const text = fs.readFileSync(e.absPath, 'utf8');
      this.texts.set(docId, { mtimeMs: e.mtimeMs, size: e.size, text });
      return text;
    } catch {
      return null;
    }
  }

  resolvePath(relPath: string): string | null {
    for (const e of this.scan.docs.values()) if (e.path === relPath) return e.id;
    return null;
  }

  docRef(e: DocEntry): DocumentRef {
    return {
      id: e.id,
      path: e.path,
      title: this.docTitle(e),
      kind: this.docKind(e),
      updatedAt: new Date(e.mtimeMs).toISOString(),
    };
  }

  private docKind(e: DocEntry): DocKind {
    if (e.path === CONSTITUTION_PATH) return 'constitution';
    if (!e.featureId) return 'other';
    return artifactKindOf(e.path.slice(`specs/${e.featureId}/`.length)) ?? 'other';
  }

  private docTitle(e: DocEntry): string {
    const fallback = e.path.split('/').pop() ?? e.path;
    if (e.format !== 'markdown') return fallback;
    const text = this.readText(e.id);
    const m = text ? H1_RE.exec(text) : null;
    return m ? m[1].trim() : fallback;
  }

  private build(): void {
    this.features.clear();
    if (!this.scan.isSpecKit) {
      this.project = null;
      return;
    }
    const { features, unrecognized } = classifyFeatureDirs(this.scan.featureDirs);
    this.featureOrder = features;
    const docsByFeature = new Map<string, DocEntry[]>();
    for (const e of this.scan.docs.values()) {
      if (!e.featureId) continue;
      const list = docsByFeature.get(e.featureId) ?? [];
      list.push(e);
      docsByFeature.set(e.featureId, list);
    }
    for (const f of features) {
      const entries = docsByFeature.get(f.id) ?? [];
      this.features.set(f.id, this.buildFeature(f, entries));
    }
    const init = readInitOptions(this.root);
    const constEntry = [...this.scan.docs.values()].find((e) => e.path === CONSTITUTION_PATH);
    const constText = constEntry ? this.readText(constEntry.id) : null;
    this.project = {
      name: this.name,
      mode: this.mode,
      specKitVersion: init.specKitVersion,
      integration: init.integration,
      script: init.script,
      featureNumbering: init.featureNumbering,
      currentFeatureId: readCurrentFeatureId(
        this.root,
        features.map((f) => f.id),
      ),
      constitution: constEntry && constText !== null ? parseConstitution(constEntry.id, constText) : null,
      features: features.map((f) => toSummary(this.features.get(f.id)!)),
      unrecognizedDirs: unrecognized,
      generatedAt: this.generatedAt,
    };
  }

  /** Parse results are cached per document until its mtime changes. */
  private analyze<T>(docId: string, kind: string, fn: (text: string) => T): T | null {
    const e = this.scan.docs.get(docId);
    if (!e) return null;
    const key = `${docId}:${kind}`;
    const hit = this.analyses.get(key);
    if (hit && hit.mtimeMs === e.mtimeMs) return hit.value as T;
    const text = this.readText(docId);
    if (text === null) return null;
    const value = fn(text);
    this.analyses.set(key, { mtimeMs: e.mtimeMs, value });
    return value;
  }

  protected buildFeature(f: FeatureName, entries: DocEntry[]): Feature {
    const refs = entries.map((e) => this.docRef(e));
    const { artifacts, extraDocs } = buildArtifactSlots(f.id, refs);
    const slot = (kind: string) => artifacts.find((a) => a.kind === kind)?.docs ?? [];
    const specRef = slot('spec')[0];
    const tasksRef = slot('tasks')[0];
    const title = specRef
      ? specRef.title.replace(FEATURE_TITLE_PREFIX, '').trim() || f.shortName
      : f.shortName;
    const updated = entries.reduce((m, e) => Math.max(m, e.mtimeMs), 0);

    const spec = specRef ? this.analyze(specRef.id, 'spec', analyzeSpec) : null;
    const tasks = tasksRef
      ? this.analyze(tasksRef.id, 'tasks', (text) => parseTasks(tasksRef.id, text))
      : null;
    const checklists = slot('checklists')
      .filter((d) => d.path.endsWith('.md'))
      .map((d) => {
        const name = (d.path.split('/').pop() ?? d.path).replace(/\.md$/, '');
        return this.analyze(d.id, 'checklist', (text) => parseChecklist(d.id, name, text));
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    const stage = computeStage({
      constitutionFilled: this.constitutionFilled(),
      hasSpec: !!specRef,
      clarificationSessions: spec?.clarifications.sessions ?? 0,
      hasPlan: slot('plan').length > 0,
      hasExtraChecklist: checklists.some((c) => c.name !== 'requirements'),
      hasTasks: !!tasksRef,
      tasksDone: tasks?.stats.done ?? 0,
      tasksTotal: tasks?.stats.total ?? 0,
    });

    return {
      ...f,
      title,
      artifacts,
      extraDocs,
      stage,
      tasks: tasks?.stats ?? null,
      checklists,
      clarifications: {
        open: spec?.clarifications.open ?? 0,
        sessions: spec?.clarifications.sessions ?? 0,
        specDocId: specRef?.id ?? null,
        marks: spec?.clarifications.marks ?? [],
      },
      updatedAt: new Date(updated || Date.now()).toISOString(),
      specSummary: spec?.summary ?? null,
      taskItems: tasks?.items ?? [],
    };
  }

  private constitutionFilled(): boolean {
    const e = [...this.scan.docs.values()].find((d) => d.path === CONSTITUTION_PATH);
    if (!e) return false;
    return this.analyze(e.id, 'constitution', (text) => parseConstitution(e.id, text))?.filled ?? false;
  }

  private definitions(docId: string): Record<string, string> {
    const e = this.scan.docs.get(docId);
    if (!e || e.format !== 'markdown') return {};
    return this.analyze(docId, 'defs', (text) => assignDefinitionAnchors(parseMarkdown(text))) ?? {};
  }

  /** id → definition in the same feature; FR/SC prefer spec.md, T prefers tasks.md, CHK prefers checklists. */
  private featureDefinitions(featureId: string): Map<string, { docId: string; anchor: string }> {
    const map = new Map<string, { docId: string; anchor: string }>();
    const docs = [...this.scan.docs.values()].filter((d) => d.featureId === featureId);
    const rank = (d: DocEntry, id: string) => {
      const name = d.path.slice(`specs/${featureId}/`.length);
      if (/^(FR|SC)-/.test(id)) return name === 'spec.md' ? 0 : 1;
      if (id.startsWith('CHK')) return name.startsWith('checklists/') ? 0 : 1;
      return name === 'tasks.md' ? 0 : 1;
    };
    const best = new Map<string, number>();
    for (const d of docs.sort((a, b) => (a.path < b.path ? -1 : 1))) {
      for (const [id, anchor] of Object.entries(this.definitions(d.id))) {
        const r = rank(d, id);
        if (!best.has(id) || r < best.get(id)!) {
          best.set(id, r);
          map.set(id, { docId: d.id, anchor });
        }
      }
    }
    return map;
  }

  private xrefResolver(e: DocEntry) {
    const own = this.definitions(e.id);
    const feature = e.featureId
      ? this.featureDefinitions(e.featureId)
      : new Map<string, { docId: string; anchor: string }>();
    return (id: string) => {
      if (own[id]) return { href: docHref(e.id, own[id]), anchor: own[id], self: true };
      const t = feature.get(id);
      return t ? { href: docHref(t.docId, t.anchor), anchor: t.anchor, self: false } : null;
    };
  }

  /** Full-text index of every registered document (cached per document mtime). */
  searchIndex(): SearchIndexEntry[] {
    const order = new Map(this.featureOrder.map((f, i) => [f.id, i]));
    return this.entries()
      .sort((a, b) => (a.path < b.path ? -1 : 1))
      .map((e) => {
        const built = this.analyze(e.id, 'search', (text) => buildSearchText(text, e.format)) ?? {
          text: '',
          headings: [],
        };
        return {
          docId: e.id,
          featureId: e.featureId,
          featureOrder: e.featureId
            ? (order.get(e.featureId) ?? 9999)
            : e.path === CONSTITUTION_PATH
              ? -1
              : 9999,
          title: this.docTitle(e),
          path: e.path,
          ...built,
        };
      });
  }

  getProject(): ProjectResponse {
    if (!this.project)
      return {
        status: 'NOT_SPECKIT_PROJECT',
        name: this.name,
        canInit: this.mode === 'local',
        mode: this.mode,
      };
    return { status: 'OK', ...this.project };
  }

  getFeature(id: string): Feature | null {
    return this.features.get(id) ?? null;
  }

  featureIds(): string[] {
    return this.featureOrder.map((f) => f.id);
  }

  async getDoc(docId: string, part = 0): Promise<DocumentData | null> {
    const e = this.scan.docs.get(docId);
    if (!e) return null;
    const key = `${docId}:${part}`;
    const cached = this.rendered.get(key);
    if (cached && cached.mtimeMs === e.mtimeMs) return cached.data;
    const text = this.readText(docId);
    if (text === null) return null;
    const parts = splitParts(text);
    if (part < 0 || part >= parts.length) return null;
    const marks: DocumentData['clarificationMarks'] = [];
    const result = await renderMarkdown(asMarkdownSource(parts[part], e.path, e.format), {
      docPath: e.path,
      docId: e.id,
      resolveDoc: (p) => this.resolvePath(p),
      plugins: [rehypeClarificationMarks(marks), rehypeXref(this.xrefResolver(e))],
    });
    const data: DocumentData = {
      ...this.docRef(e),
      featureId: e.featureId,
      format: e.format,
      html: result.html,
      outline: result.outline,
      anchors: result.anchors,
      clarificationMarks: marks,
      size: e.size,
      truncated: parts.length > 1,
      parts: parts.length,
      part,
    };
    this.rendered.set(key, { mtimeMs: e.mtimeMs, data });
    return data;
  }
}

export function toSummary(f: Feature): FeatureSummary {
  const { specSummary: _s, taskItems: _t, ...summary } = f;
  return summary;
}
