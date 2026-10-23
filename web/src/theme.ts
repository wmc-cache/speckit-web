export type ThemeMode = 'system' | 'light' | 'dark';
const STORAGE_KEY = 'speckit-web.theme';
const media = () => window.matchMedia('(prefers-color-scheme: dark)');

export function initialThemeMode(): ThemeMode {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === 'light' || saved === 'dark' ? saved : 'system';
}

export function effectiveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode !== 'system') return mode;
  return media().matches ? 'dark' : 'light';
}

/** Applies the theme to <html data-theme> and keeps following the OS while in "system" mode. */
export function applyTheme(mode: ThemeMode, onChange?: (t: 'light' | 'dark') => void): () => void {
  if (mode === 'system') localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, mode);
  const set = () => {
    const t = effectiveTheme(mode);
    document.documentElement.dataset.theme = t;
    onChange?.(t);
  };
  set();
  const mq = media();
  mq.addEventListener('change', set);
  return () => mq.removeEventListener('change', set);
}

export function nextThemeMode(mode: ThemeMode): ThemeMode {
  return mode === 'system' ? 'light' : mode === 'light' ? 'dark' : 'system';
}
