import { useEffect, useMemo, useState } from 'react';
import type { Heading } from '../../../src/core/model.ts';
import { useT } from '../i18n/index.ts';
import { docHref } from '../router.ts';

/** Table of contents for the open document; highlights the section in view. */
export function Outline({ docId, outline }: { docId: string; outline: Heading[] }) {
  const t = useT();
  const [active, setActive] = useState<string | null>(null);
  const items = useMemo(() => outline.filter((h) => h.depth >= 1 && h.depth <= 6), [outline]);

  useEffect(() => {
    const els = items.map((h) => document.getElementById(h.anchor)).filter((e): e is HTMLElement => !!e);
    if (!els.length) return;
    const onScroll = () => {
      let current: string | null = els[0].id;
      for (const el of els) if (el.getBoundingClientRect().top < 120) current = el.id;
      setActive(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [items]);

  if (!items.length) return <aside className="outline" />;
  return (
    <aside className="outline" aria-label={t('doc.outline')}>
      <h2>{t('doc.outline')}</h2>
      <ul>
        {items.map((h) => (
          <li key={h.anchor} className={`depth-${h.depth}`}>
            <a href={docHref(docId, h.anchor)} className={active === h.anchor ? 'active' : ''} title={h.text}>
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
