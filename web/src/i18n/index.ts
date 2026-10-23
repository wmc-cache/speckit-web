import { createContext, useContext } from 'react';
import en from './en.json';
import zhCN from './zh-CN.json';

export type Lang = 'zh-CN' | 'en';
export type MessageKey = keyof typeof en;
export type TFunction = (key: MessageKey, vars?: Record<string, string | number>) => string;

export const LANGS: { value: Lang; label: string }[] = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'en', label: 'English' },
];

const dicts: Record<Lang, Record<string, string>> = { 'zh-CN': zhCN, en };
const STORAGE_KEY = 'speckit-web.lang';

export function initialLang(): Lang {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'zh-CN' || saved === 'en') return saved;
  return /^zh/i.test(navigator.language) ? 'zh-CN' : 'en';
}

export function saveLang(lang: Lang): void {
  localStorage.setItem(STORAGE_KEY, lang);
}

export function makeT(lang: Lang): TFunction {
  return (key, vars = {}) => {
    const template = dicts[lang][key] ?? dicts.en[key] ?? key;
    return template.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
  };
}

export const I18nContext = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: TFunction }>({
  lang: 'en',
  setLang: () => {},
  t: makeT('en'),
});

export function useI18n() {
  return useContext(I18nContext);
}

export function useT(): TFunction {
  return useContext(I18nContext).t;
}
