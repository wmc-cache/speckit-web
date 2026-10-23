import fs from 'node:fs';
import path from 'node:path';
import { ProjectStore } from '../core/project.ts';
import { isInside } from '../core/scan.ts';
import { t } from '../i18n/index.ts';
import { CliError, EXIT } from '../cli/exit-codes.ts';
import { packageVersion, webRoot } from '../paths.ts';
import { injectMeta } from '../server/app.ts';

export const BUILD_MARKER = '.speckit-web-build';

export interface ExportOptions {
  out?: string;
  title?: string;
}

export interface ExportSummary {
  out: string;
  features: number;
  documents: number;
  bytes: number;
  durationMs: number;
}

function prepareOutDir(out: string): void {
  if (!fs.existsSync(out)) return;
  const entries = fs.readdirSync(out);
  if (entries.length === 0) return;
  if (!entries.includes(BUILD_MARKER))
    throw new CliError(t('build.refuseClean', { out }), EXIT.RUNTIME_ERROR);
  fs.rmSync(out, { recursive: true, force: true });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
}

/** Static publishing: pre-built web app + JSON data with exactly the local API payloads. */
export async function exportSite(dir: string, opts: ExportOptions): Promise<ExportSummary> {
  const started = Date.now();
  const root = path.resolve(dir);
  const store = new ProjectStore(root, { mode: 'static', title: opts.title });
  if (!store.isSpecKit) throw new CliError(t('build.notSpecKit', { dir: root }), EXIT.NOT_SPECKIT);

  const out = path.resolve(opts.out ?? path.join(root, 'speckit-site'));
  for (const inner of ['specs', '.specify']) {
    if (isInside(path.join(root, inner), out))
      throw new CliError(t('build.refuseInside', { out }), EXIT.RUNTIME_ERROR);
  }
  prepareOutDir(out);
  fs.mkdirSync(out, { recursive: true });
  fs.cpSync(webRoot(), out, { recursive: true });

  let bytes = 0;
  const write = (rel: string, content: string) => {
    const file = path.join(out, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
    bytes += Buffer.byteLength(content);
  };
  const writeJson = (rel: string, data: unknown) => write(rel, JSON.stringify(data));

  const indexFile = path.join(out, 'index.html');
  let html = injectMeta(fs.readFileSync(indexFile, 'utf8'), 'static', '');
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(store.name)} · Spec Kit Web</title>`);
  fs.writeFileSync(indexFile, html);

  writeJson('data/project.json', store.getProject());
  const featureIds = store.featureIds();
  for (const id of featureIds) writeJson(`data/features/${id}.json`, store.getFeature(id));

  const entries = store.entries().sort((a, b) => (a.path < b.path ? -1 : 1));
  for (const e of entries) {
    const first = await store.getDoc(e.id, 0);
    if (!first) continue;
    writeJson(`data/docs/${e.id}.json`, first);
    for (let k = 1; k < first.parts; k++)
      writeJson(`data/docs/${e.id}.part-${k}.json`, await store.getDoc(e.id, k));
  }

  writeJson('data/search.json', store.searchIndex());
  write('.nojekyll', '');
  write(
    BUILD_MARKER,
    JSON.stringify({ tool: 'speckit-web', version: packageVersion(), builtAt: new Date().toISOString() }),
  );

  return {
    out,
    features: featureIds.length,
    documents: entries.length,
    bytes,
    durationMs: Date.now() - started,
  };
}
