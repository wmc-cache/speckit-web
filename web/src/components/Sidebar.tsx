import { useMemo } from 'react';
import type { FeatureSummary } from '../../../src/core/model.ts';
import { useData } from '../data/context.ts';
import { useT, type MessageKey } from '../i18n/index.ts';
import { docHref, featureHref, href, useRoute } from '../router.ts';

function fileLabel(path: string): string {
  return (path.split('/').pop() ?? path).replace(/\.md$/, '');
}

function FeatureDocs({ feature, activeDocId }: { feature: FeatureSummary; activeDocId: string | null }) {
  const t = useT();
  return (
    <div className="nav-feature-docs">
      {feature.artifacts.map((slot) => {
        const label = t(`artifact.${slot.kind}` as MessageKey);
        if (slot.status === 'missing')
          return (
            <div key={slot.kind} className="nav-missing" title={t('artifact.missing')}>
              <span className="nav-label">{label}</span>
              <span className="badge">{t('artifact.missing')}</span>
            </div>
          );
        const multi = slot.kind === 'contracts' || slot.kind === 'checklists';
        return slot.docs.map((d) => (
          <a key={d.id} className={`nav-link${activeDocId === d.id ? ' active' : ''}`} href={docHref(d.id)}>
            <span className="nav-label">{multi ? `${label} · ${fileLabel(d.path)}` : label}</span>
          </a>
        ));
      })}
      {feature.extraDocs.map((d) => (
        <a key={d.id} className={`nav-link${activeDocId === d.id ? ' active' : ''}`} href={docHref(d.id)}>
          <span className="nav-label">{fileLabel(d.path)}</span>
        </a>
      ))}
    </div>
  );
}

export function Sidebar() {
  const t = useT();
  const route = useRoute();
  const { project } = useData();
  const [seg0, seg1] = route.segments;

  const docToFeature = useMemo(() => {
    const m = new Map<string, string>();
    if (project?.status !== 'OK') return m;
    for (const f of project.features) {
      for (const slot of f.artifacts) for (const d of slot.docs) m.set(d.id, f.id);
      for (const d of f.extraDocs) m.set(d.id, f.id);
    }
    return m;
  }, [project]);

  if (project?.status !== 'OK') return null;
  const activeDocId = seg0 === 'd' ? (seg1 ?? null) : null;
  const activeFeature = seg0 === 'f' ? seg1 : activeDocId ? docToFeature.get(activeDocId) : undefined;
  const constitutionActive =
    seg0 === 'constitution' || (activeDocId !== null && activeDocId === project.constitution?.docId);

  return (
    <nav className="sidebar" aria-label={t('nav.features')}>
      <div className="sidebar-section">
        <a className={`nav-link${!seg0 ? ' active' : ''}`} href={href('/')}>
          {t('nav.overview')}
        </a>
        <a className={`nav-link${constitutionActive ? ' active' : ''}`} href={href('/constitution')}>
          <span className="nav-label">{t('nav.constitution')}</span>
          {project.constitution && !project.constitution.filled && (
            <span className="badge warn">{t('constitution.unfilled')}</span>
          )}
        </a>
      </div>
      <div className="sidebar-section">
        <div className="sidebar-heading">{t('nav.features')}</div>
        {project.features.map((f) => {
          const expanded = f.id === activeFeature;
          return (
            <div key={f.id} className="nav-feature" data-feature={f.id}>
              <a
                className={`nav-link${seg0 === 'f' && seg1 === f.id ? ' active' : ''}`}
                href={featureHref(f.id)}
                aria-expanded={expanded}
              >
                <span className="nav-prefix">{f.prefix}</span>
                <span className="nav-label">{f.title}</span>
                {project.currentFeatureId === f.id && (
                  <span className="badge accent">{t('nav.current')}</span>
                )}
              </a>
              {expanded && <FeatureDocs feature={f} activeDocId={activeDocId} />}
            </div>
          );
        })}
      </div>
      {project.unrecognizedDirs.length > 0 && (
        <div className="sidebar-section">
          <div className="sidebar-heading">{t('nav.unrecognized')}</div>
          {project.unrecognizedDirs.map((d) => (
            <div key={d} className="nav-missing">
              <span className="nav-label">specs/{d}/</span>
            </div>
          ))}
        </div>
      )}
    </nav>
  );
}
