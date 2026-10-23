import { Component, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DataContext, useData } from './data/context.ts';
import { createDataSource } from './data/source.ts';
import { useLiveData } from './hooks/useLiveData.ts';
import { I18nContext, initialLang, LANGS, makeT, saveLang, useI18n, useT, type Lang } from './i18n/index.ts';
import { useRoute } from './router.ts';
import { applyTheme, initialThemeMode, nextThemeMode, type ThemeMode } from './theme.ts';
import { Dropdown } from './components/Dropdown.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { SearchBox } from './components/SearchBox.tsx';
import { Overview } from './routes/Overview.tsx';
import { FeatureView } from './routes/FeatureView.tsx';
import { DocView } from './routes/DocView.tsx';
import { ConstitutionView } from './routes/ConstitutionView.tsx';
import { NotSpeckit } from './routes/NotSpeckit.tsx';
import { SearchView } from './routes/SearchView.tsx';
import { InitWizard } from './routes/InitWizard.tsx';

class ErrorBoundary extends Component<
  { children: ReactNode; message: (e: Error) => ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    return this.state.error ? this.props.message(this.state.error) : this.props.children;
  }
}

const THEME_ICON: Record<ThemeMode, string> = { system: '◐', light: '☀', dark: '☾' };

function TopBar({ onToggleNav }: { onToggleNav: () => void }) {
  const { t, lang, setLang } = useI18n();
  const { project, connection, source } = useData();
  const [mode, setMode] = useState<ThemeMode>(initialThemeMode);
  useEffect(() => applyTheme(mode), [mode]);
  const name = project?.name ?? '';
  return (
    <header className="topbar">
      <button
        type="button"
        className="icon-button nav-toggle"
        aria-label={t('nav.toggle')}
        onClick={onToggleNav}
      >
        ☰
      </button>
      <a className="brand" href="#/">
        <span className="brand-mark" aria-hidden>
          ◆
        </span>
        <span className="brand-name">{name || t('app.title')}</span>
      </a>
      <div className="topbar-search">{project?.status === 'OK' && <SearchBox />}</div>
      <div className="topbar-actions">
        {source.mode === 'local' && (
          <span
            className={`live-indicator ${connection}`}
            title={t(connection === 'connected' ? 'live.connected' : 'live.disconnected')}
          >
            <span className="live-dot" aria-hidden />
            <span className="live-label">
              {t(connection === 'connected' ? 'live.connected' : 'live.disconnected')}
            </span>
          </span>
        )}
        <Dropdown
          ariaLabel={t('lang.label')}
          options={LANGS}
          value={lang}
          onChange={(l) => setLang(l)}
          className="lang-dropdown"
          testId="lang-dropdown"
        />
        <button
          type="button"
          className="icon-button"
          aria-label={`${t('theme.toggle')}: ${t(`theme.${mode}`)}`}
          title={`${t('theme.toggle')}: ${t(`theme.${mode}`)}`}
          onClick={() => setMode(nextThemeMode(mode))}
        >
          {THEME_ICON[mode]}
        </button>
      </div>
    </header>
  );
}

function Content() {
  const t = useT();
  const route = useRoute();
  const { project, projectError, reloadProject, source } = useData();
  const [seg0, seg1, artifact] = route.segments;

  if (projectError)
    return (
      <div className="notice error">
        <p>{t('error.generic', { msg: projectError })}</p>
        <button type="button" className="button" onClick={reloadProject}>
          {t('error.retry')}
        </button>
      </div>
    );
  if (!project) return <p className="muted">{t('doc.loading')}</p>;
  if (seg0 === 'init')
    return source.mode === 'local' ? <InitWizard /> : <p className="notice">{t('init.staticUnavailable')}</p>;
  if (project.status !== 'OK') return <NotSpeckit name={project.name} />;
  switch (seg0) {
    case 'constitution':
      return <ConstitutionView />;
    case 'f':
      return (
        <FeatureView
          key={`${seg1}/${artifact ?? ''}`}
          featureId={seg1 ?? ''}
          artifact={artifact}
          anchor={route.query.get('h')}
        />
      );
    case 'd':
      return (
        <DocView
          key={seg1}
          docId={seg1 ?? ''}
          anchor={route.query.get('h')}
          highlight={route.query.get('q')}
        />
      );
    case 'search':
      return <SearchView query={route.query.get('q') ?? ''} />;
    default:
      return <Overview />;
  }
}

function Shell() {
  const t = useT();
  const route = useRoute();
  const { project } = useData();
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => setNavOpen(false), [route.path]);
  useEffect(() => {
    document.title = project?.name ? `${project.name} · Spec Kit Web` : 'Spec Kit Web';
  }, [project?.name]);
  const showNav = project?.status === 'OK';
  return (
    <div className={`app ${showNav ? 'with-nav' : ''} ${navOpen ? 'nav-open' : ''}`}>
      <TopBar onToggleNav={() => setNavOpen((o) => !o)} />
      {showNav && <Sidebar />}
      <main className="content" id="content">
        <ErrorBoundary
          key={route.path}
          message={(e) => <div className="notice error">{t('error.generic', { msg: e.message })}</div>}
        >
          <Content />
        </ErrorBoundary>
      </main>
    </div>
  );
}

export function App() {
  const source = useMemo(() => createDataSource(), []);
  const data = useLiveData(source);
  const [lang, setLangState] = useState<Lang>(initialLang);
  const i18n = useMemo(
    () => ({
      lang,
      t: makeT(lang),
      setLang: (l: Lang) => {
        saveLang(l);
        setLangState(l);
      },
    }),
    [lang],
  );
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return (
    <I18nContext.Provider value={i18n}>
      <DataContext.Provider value={data}>
        <Shell />
      </DataContext.Provider>
    </I18nContext.Provider>
  );
}
