import { useData } from '../data/context.ts';
import { useT } from '../i18n/index.ts';
import { DocView } from './DocView.tsx';

export function ConstitutionView() {
  const t = useT();
  const { project } = useData();
  if (project?.status !== 'OK') return null;
  const c = project.constitution;
  if (!c) return <div className="notice warn">{t('constitution.missing')}</div>;
  return (
    <div>
      <div className="card constitution-meta" data-testid="constitution-meta">
        {!c.filled && (
          <p className="notice warn" role="status">
            <span className="badge warn">{t('constitution.unfilled')}</span> {t('constitution.unfilledHint')}
          </p>
        )}
        <dl className="meta-list">
          <dt>{t('constitution.version')}</dt>
          <dd>{c.version ?? '—'}</dd>
          <dt>{t('constitution.ratified')}</dt>
          <dd>{c.ratified ?? '—'}</dd>
          <dt>{t('constitution.lastAmended')}</dt>
          <dd>{c.lastAmended ?? '—'}</dd>
        </dl>
      </div>
      <DocView docId={c.docId} anchor={null} />
    </div>
  );
}
