import { exportSite } from '../build/export.ts';
import { t } from '../i18n/index.ts';

export async function runBuild(
  dir: string,
  opts: { out?: string; title?: string; json?: boolean },
): Promise<void> {
  const summary = await exportSite(dir, { out: opts.out, title: opts.title });
  if (opts.json) {
    console.log(JSON.stringify(summary));
    return;
  }
  console.log(
    t('build.done', {
      features: summary.features,
      documents: summary.documents,
      out: summary.out,
      ms: summary.durationMs,
    }),
  );
  console.log(t('build.pagesHint'));
}
