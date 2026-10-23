import { useData } from '../data/context.ts';
import { useT } from '../i18n/index.ts';
import { href } from '../router.ts';

export function NotSpeckit({ name }: { name: string }) {
  const t = useT();
  const { source } = useData();
  return (
    <section className="empty-state" data-testid="not-speckit">
      <h1 className="page-title">{t('notSpeckit.title')}</h1>
      <p className="page-subtitle">{t('notSpeckit.body', { name })}</p>
      {source.mode === 'local' && (
        <p>
          <a className="button primary" href={href('/init')}>
            {t('notSpeckit.wizard')}
          </a>
        </p>
      )}
      <p className="muted">{t('notSpeckit.cli')}</p>
      <pre className="command">npx speckit-web init --here</pre>
    </section>
  );
}
