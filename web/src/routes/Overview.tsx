import { ProgressBar } from '../components/ProgressBar.tsx';
import { useData } from '../data/context.ts';
import { useT, type MessageKey } from '../i18n/index.ts';
import { featureHref } from '../router.ts';

export function Overview() {
  const t = useT();
  const { project } = useData();
  if (project?.status !== 'OK') return null;
  return (
    <section data-testid="overview">
      <h1 className="page-title">{t('overview.title')}</h1>
      <p className="page-subtitle">
        {t('overview.meta', {
          version: project.specKitVersion ?? '?',
          integration: project.integration ?? '?',
          script: project.script ?? '?',
          numbering: t(`numbering.${project.featureNumbering}` as MessageKey),
        })}
      </p>
      {project.features.length === 0 ? (
        <div className="notice">{t('overview.empty')}</div>
      ) : (
        <div className="card table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>{t('overview.col.feature')}</th>
                <th>{t('overview.col.stage')}</th>
                <th>{t('overview.col.tasks')}</th>
                <th>{t('overview.col.clarify')}</th>
              </tr>
            </thead>
            <tbody>
              {project.features.map((f) => (
                <tr key={f.id} data-feature={f.id}>
                  <td>
                    <a href={featureHref(f.id)}>
                      <span className="nav-prefix">{f.prefix}</span> {f.title}
                    </a>
                    {project.currentFeatureId === f.id && (
                      <span className="badge accent"> {t('nav.current')}</span>
                    )}
                  </td>
                  <td data-testid="current-stage">
                    {f.stage?.current ? (
                      <span className="badge accent">{t(`stage.${f.stage.current}` as MessageKey)}</span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td data-testid="task-progress">
                    {f.tasks ? (
                      <ProgressBar done={f.tasks.done} total={f.tasks.total} />
                    ) : (
                      <span className="muted">{t('overview.noTasks')}</span>
                    )}
                  </td>
                  <td data-testid="open-clarifications">
                    {f.clarifications.open > 0 ? (
                      <span className="badge warn">
                        {t('feature.clarifyOpen', { n: f.clarifications.open })}
                      </span>
                    ) : (
                      <span className="muted">0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
