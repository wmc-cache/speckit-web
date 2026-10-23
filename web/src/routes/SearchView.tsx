import { useEffect, useState } from 'react';
import type { SearchResult } from '../../../src/core/model.ts';
import { useData } from '../data/context.ts';
import { useT } from '../i18n/index.ts';
import { href } from '../router.ts';

export function SearchView({ query }: { query: string }) {
  const t = useT();
  const { source, project, projectVersion } = useData();
  const [result, setResult] = useState<SearchResult | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResult(null);
      return;
    }
    let cancelled = false;
    source.search(query, 100).then(
      (r) => !cancelled && setResult(r),
      () => !cancelled && setResult({ query, hits: [], total: 0 }),
    );
    return () => {
      cancelled = true;
    };
  }, [source, query, projectVersion]);

  const featureTitle = (id: string | null) =>
    id && project?.status === 'OK'
      ? (project.features.find((f) => f.id === id)?.title ?? id)
      : t('nav.constitution');

  if (!query.trim()) return <p className="muted">{t('search.empty')}</p>;
  if (!result) return <p className="muted">{t('doc.loading')}</p>;

  const groups = new Map<string, typeof result.hits>();
  for (const h of result.hits) {
    const key = h.featureId ?? '';
    groups.set(key, [...(groups.get(key) ?? []), h]);
  }

  return (
    <section data-testid="search-view">
      <h1 className="page-title">{t('search.title')}</h1>
      <p className="page-subtitle">
        {result.total ? t('search.results', { n: result.total }) : t('search.none', { q: query })}
      </p>
      {[...groups].map(([featureId, hits]) => (
        <div key={featureId} className="search-group">
          <div className="sidebar-heading">
            {featureId ? `${featureId} · ${featureTitle(featureId)}` : featureTitle(null)}
          </div>
          <ul className="search-results">
            {hits.map((h) => (
              <li key={h.docId}>
                <a
                  className="search-hit"
                  href={href(`/d/${h.docId}`, { h: h.anchor, q: query })}
                  data-testid="search-hit"
                >
                  <div className="search-hit-title">{h.title}</div>
                  <div className="search-hit-path">{h.path}</div>
                  <div className="search-hit-snippet" dangerouslySetInnerHTML={{ __html: h.snippet }} />
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
