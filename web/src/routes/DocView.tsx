import { normalize } from '../../../src/core/search.ts';
import { useEffect, useRef, useState } from 'react';
import type { DocumentData } from '../../../src/core/model.ts';
import { Outline } from '../components/Outline.tsx';
import { useData } from '../data/context.ts';
import { useI18n, type MessageKey } from '../i18n/index.ts';
import { highlightText } from '../lib/highlight.ts';
import { renderMermaid } from '../lib/mermaid.ts';
import { featureHref } from '../router.ts';

function currentTheme(): 'light' | 'dark' {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

interface Props {
  docId: string;
  anchor: string | null;
  highlight?: string | null;
}

export function DocView({ docId, anchor, highlight }: Props) {
  const { t, lang } = useI18n();
  const { source, lastChange, projectVersion } = useData();
  const [doc, setDoc] = useState<DocumentData | null>(null);
  const [extraHtml, setExtraHtml] = useState<string[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'deleted'>('loading');
  const [reload, setReload] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    source
      .getDoc(docId)
      .then((d) => {
        if (cancelled) return;
        if (d) setDoc(d);
        setExtraHtml([]);
        setState((previous) =>
          d ? 'ready' : previous === 'loading' || previous === 'missing' ? 'missing' : 'deleted',
        );
      })
      .catch(() => !cancelled && setState('missing'));
    return () => {
      cancelled = true;
    };
  }, [source, docId, reload, projectVersion]);

  // Live updates: refetch when this document changes, warn when it is deleted.
  useEffect(() => {
    if (!lastChange || !lastChange.docIds.includes(docId)) return;
    if (lastChange.type === 'removed') setState('deleted');
    else if (lastChange.type === 'document') setReload((r) => r + 1);
  }, [lastChange, docId]);

  useEffect(() => {
    const targetPart = anchor && doc ? (doc.anchorParts?.[anchor] ?? 0) : 0;
    if (!doc || targetPart <= extraHtml.length) return;
    let cancelled = false;
    void Promise.all(Array.from({ length: targetPart }, (_, i) => source.getDoc(docId, i + 1))).then(
      (parts) => {
        if (!cancelled) setExtraHtml(parts.filter((p) => p !== null).map((p) => p!.html));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [source, docId, doc, anchor, extraHtml.length]);

  // After the HTML is in the DOM: tooltips, mermaid, search highlight, scroll to the anchor.
  useEffect(() => {
    const el = bodyRef.current;
    if (!el || state !== 'ready') return;
    for (const span of el.querySelectorAll<HTMLElement>('[data-unpublished]'))
      span.title = t('doc.unpublished');
    void renderMermaid(el, currentTheme());
    const hit = highlightText(el, highlight ?? '');
    const target = hit ?? (anchor ? document.getElementById(anchor) : null);
    if (highlight && !hit && doc && 1 + extraHtml.length < doc.parts) {
      const loadedText = normalize(el.textContent ?? '');
      if (!loadedText.includes(normalize(highlight.trim()))) {
        let cancelled = false;
        void source.getDoc(docId, 1 + extraHtml.length).then((next) => {
          if (!cancelled && next) setExtraHtml((parts) => [...parts, next.html]);
        });
        return () => {
          cancelled = true;
        };
      }
    }
    if (target) {
      target.scrollIntoView({ block: 'start' });
      if (anchor) {
        target.classList.remove('target-flash');
        void target.offsetWidth;
        target.classList.add('target-flash');
      }
    } else if (!anchor) {
      window.scrollTo({ top: 0 });
    }
  }, [doc, extraHtml, state, anchor, highlight, t, source, docId]);

  // Re-render diagrams when the theme changes.
  useEffect(() => {
    const obs = new MutationObserver(
      () => bodyRef.current && void renderMermaid(bodyRef.current, currentTheme()),
    );
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  if (state === 'loading') return <p className="muted">{t('doc.loading')}</p>;
  if (state === 'missing' || !doc) return <div className="notice warn">{t('doc.notFound')}</div>;

  const loaded = 1 + extraHtml.length;
  const loadMore = async () => {
    const next = await source.getDoc(docId, loaded);
    if (next) setExtraHtml((h) => [...h, next.html]);
  };
  const kindLabel =
    doc.kind === 'other' || doc.kind === 'constitution' ? null : t(`artifact.${doc.kind}` as MessageKey);

  return (
    <div className="doc-layout">
      <article className="doc">
        {state === 'deleted' && (
          <div className="notice warn" role="alert">
            {t('doc.deleted')}
          </div>
        )}
        <div className="doc-header">
          {doc.featureId && (
            <a href={featureHref(doc.featureId)} className="badge accent">
              {doc.featureId}
            </a>
          )}
          {kindLabel && <span className="badge">{kindLabel}</span>}
          <span className="doc-path">{doc.path}</span>
          <span>· {t('doc.updated', { time: new Date(doc.updatedAt).toLocaleString(lang) })}</span>
        </div>
        {doc.truncated && <div className="notice">{t('doc.truncated')}</div>}
        <div ref={bodyRef} className="markdown" data-testid="doc-body">
          <div dangerouslySetInnerHTML={{ __html: doc.html }} />
          {extraHtml.map((h, i) => (
            <div key={i} dangerouslySetInnerHTML={{ __html: h }} />
          ))}
        </div>
        {doc.truncated && loaded < doc.parts && (
          <button type="button" className="button" onClick={() => void loadMore()}>
            {t('doc.loadMore', { part: loaded + 1, parts: doc.parts })}
          </button>
        )}
      </article>
      <Outline docId={docId} outline={doc.outline} />
    </div>
  );
}
