import { useEffect, useMemo, useState } from 'react';
import type { Heading } from '../../../src/core/model.ts';
import { useT } from '../i18n/index.ts';
import { docHref } from '../router.ts';

/** Table of contents for the open document; highlights the section in view. */
export function Outline({ docId, outline }: { docId: string; outline: Heading[] }) {
  const t = useT();
  const [expanded, setExpanded] = useState(() => window.matchMedia('(min-width: 1101px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1101px)');
    const update = () => setExpanded(mq.matches);
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
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

  if (!items.length) return null;
  return (
    <aside className="outline" aria-label={t('doc.outline')}>
      <details open={expanded} onToggle={(e) => setExpanded(e.currentTarget.open)}>
        <summary>
          {t('doc.outline')} <span className="outline-count">{items.length}</span>
        </summary>
        <ul>
          {items.map((h) => (
            <li key={h.anchor} className={`depth-${h.depth}`}>
              <a
                href={docHref(docId, h.anchor)}
                aria-current={active === h.anchor ? 'location' : undefined}
                className={active === h.anchor ? 'active' : ''}
                title={h.text}
              >
                {h.text}
              </a>
            </li>
          ))}
        </ul>
      </details>
    </aside>
  );
}
