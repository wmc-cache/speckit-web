import { NextStep } from '../components/NextStep.tsx';
import { DocView } from './DocView.tsx';
import { useEffect, useState } from 'react';
import type { Feature } from '../../../src/core/model.ts';
import { ProgressBar } from '../components/ProgressBar.tsx';
import { StageBar } from '../components/StageBar.tsx';
import { useData } from '../data/context.ts';
import { useT, type MessageKey } from '../i18n/index.ts';
import { docHref } from '../router.ts';

export function FeatureView({
  featureId,
  artifact,
  anchor = null,
}: {
  featureId: string;
  artifact?: string;
  anchor?: string | null;
}) {
  const t = useT();
  const { source, projectVersion, project } = useData();
  const [feature, setFeature] = useState<Feature | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    source.getFeature(featureId).then(
      (f) => !cancelled && setFeature(f),
      () => !cancelled && setFeature(null),
    );
    return () => {
      cancelled = true;
    };
  }, [source, featureId, projectVersion]);

  if (feature === undefined) return <p className="muted">{t('doc.loading')}</p>;
  if (feature === null) return <div className="notice warn">{t('feature.notFound', { id: featureId })}</div>;

  if (artifact) {
    const slot = feature.artifacts.find((a) => a.kind === artifact);
    if (!slot || slot.status === 'missing') return <div className="notice warn">{t('artifact.missing')}</div>;
    if (slot.kind !== 'contracts' && slot.kind !== 'checklists' && slot.docs[0])
      return <DocView docId={slot.docs[0].id} anchor={anchor} />;
    return (
      <section>
        <h1>{t(`artifact.${slot.kind}` as MessageKey)}</h1>
        <ul>
          {slot.docs.map((d) => (
            <li key={d.id}>
              <a href={docHref(d.id)}>{d.title}</a>
            </li>
          ))}
        </ul>
      </section>
    );
  }
  const spec = feature.specSummary;
  const specDoc = feature.clarifications.specDocId;
  const tasksDoc = feature.tasks?.docId;

  return (
    <section data-testid="feature-view">
      <p className="doc-header">
        <span className="badge">{feature.id}</span>
      </p>
      <h1 className="page-title">{feature.title}</h1>
      <p className="page-subtitle">
        {t('doc.updated', { time: new Date(feature.updatedAt).toLocaleString() })}
      </p>

      <div className="feature-dashboard">
        {project?.status === 'OK' && <NextStep feature={feature} project={project} />}
        <div className="feature-metrics">
          <div className="metric">
            <span>{t('guide.ready')}</span>
            <strong>
              {feature.artifacts.filter((a) => a.status === 'present').length}
              <small> / 8</small>
            </strong>
            <div className="artifact-meter" aria-hidden>
              {feature.artifacts.map((a) => (
                <i key={a.kind} className={a.status} />
              ))}
            </div>
          </div>
          <div className="metric">
            <span>{t('guide.taskMetric')}</span>
            <strong>
              {feature.tasks?.done ?? '—'}
              <small> / {feature.tasks?.total ?? '—'}</small>
            </strong>
            {feature.tasks && <ProgressBar done={feature.tasks.done} total={feature.tasks.total} />}
          </div>
          <div className="metric">
            <span>{t('guide.openMetric')}</span>
            <strong>{feature.clarifications.open}</strong>
            <span>{t(feature.clarifications.open ? 'guide.clarify.title' : 'feature.noClarify')}</span>
          </div>
        </div>
      </div>
      {feature.stage && (
        <div className="card">
          <div className="section-heading">
            <h2>{t('guide.flow')}</h2>
            <span>{t('guide.flowNote')}</span>
          </div>
          <StageBar stage={feature.stage} />
        </div>
      )}

      {(feature.tasks || feature.clarifications.open > 0) && (
        <div className="grid-2">
          {feature.tasks && (
            <div className="card" data-testid="feature-tasks">
              <h2>{t('feature.tasks')}</h2>
              {feature.tasks ? (
                <>
                  <ProgressBar done={feature.tasks.done} total={feature.tasks.total} />
                  <details>
                    <summary>{t('feature.byPhase')}</summary>
                    <ul className="progress-groups">
                      {feature.tasks.byPhase.map((p) => (
                        <li key={p.index}>
                          <span>
                            Phase {p.index}: {p.title}
                          </span>
                          <ProgressBar done={p.done} total={p.total} />
                        </li>
                      ))}
                    </ul>
                  </details>
                  <details>
                    <summary>{t('feature.byStory')}</summary>
                    <ul className="progress-groups">
                      {feature.tasks.byStory.map((s) => (
                        <li key={s.story ?? 'none'}>
                          <span>{s.story ?? t('feature.noStory')}</span>
                          <ProgressBar done={s.done} total={s.total} />
                        </li>
                      ))}
                    </ul>
                  </details>
                  {tasksDoc && (
                    <p>
                      <a href={docHref(tasksDoc)}>tasks.md →</a>
                    </p>
                  )}
                </>
              ) : (
                <p className="muted">{t('guide.missingTasks')}</p>
              )}
            </div>
          )}

          {feature.clarifications.open > 0 && (
            <div className="card" data-testid="feature-clarifications">
              <h2>
                {feature.clarifications.open > 0
                  ? t('feature.clarifyOpen', { n: feature.clarifications.open })
                  : t('feature.noClarify')}
              </h2>
              {specDoc && feature.clarifications.marks.length > 0 && (
                <ol className="clarify-list">
                  {feature.clarifications.marks.map((m) => (
                    <li key={m.anchor}>
                      <a href={docHref(specDoc, m.anchor)}>{m.text || m.anchor}</a>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>
      )}

      {feature.checklists.length > 0 && (
        <div className="card" data-testid="feature-checklists">
          <h2>{t('feature.checklists')}</h2>
          {feature.checklists.length === 0 ? (
            <p className="muted">
              {t('guide.noChecklist')} <code>/speckit-checklist</code>
            </p>
          ) : (
            <ul className="progress-groups">
              {feature.checklists.map((c) => (
                <li key={c.docId} data-checklist={c.name}>
                  <a href={docHref(c.docId)}>{c.name}</a>
                  {c.allPassed ? (
                    <span className="badge ok">{t('feature.allPassed')}</span>
                  ) : (
                    <ProgressBar done={c.checked} total={c.total} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="card">
        <h2>{t('feature.documents')}</h2>
        <ul className="artifact-list artifact-cards">
          {feature.artifacts.map((slot) =>
            slot.status === 'missing' ? (
              <li key={slot.kind} className="artifact-tile missing">
                {t(`artifact.${slot.kind}` as MessageKey)}{' '}
                <span className="badge">{t('artifact.missing')}</span>
              </li>
            ) : (
              slot.docs.map((d) => (
                <li key={d.id} className="artifact-tile present">
                  <a href={docHref(d.id)}>{t(`artifact.${slot.kind}` as MessageKey)}</a>{' '}
                  <span className="doc-path">{d.path}</span>
                </li>
              ))
            ),
          )}
          {feature.extraDocs.map((d) => (
            <li key={d.id}>
              <a href={docHref(d.id)}>{d.title}</a> <span className="doc-path">{d.path}</span>
            </li>
          ))}
        </ul>
      </div>

      {spec && (
        <div className="grid-2">
          <div className="card">
            <h2>{t('feature.stories')}</h2>
            <ul className="plain-list">
              {spec.stories.map((s) => (
                <li key={s.anchor}>
                  {s.priority && <span className="badge accent">{s.priority}</span>}{' '}
                  {specDoc ? <a href={docHref(specDoc, s.anchor)}>{s.title}</a> : s.title}
                </li>
              ))}
            </ul>
          </div>
          <div className="card">
            <h2>
              {t('feature.requirements')} · {t('feature.successCriteria')}
            </h2>
            <ul className="plain-list">
              {[...spec.requirements, ...spec.successCriteria].map((r) => (
                <li key={r.id}>
                  {specDoc ? (
                    <a href={docHref(specDoc, r.anchor)} className="xref">
                      {r.id}
                    </a>
                  ) : (
                    r.id
                  )}{' '}
                  <span className="muted">{r.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
