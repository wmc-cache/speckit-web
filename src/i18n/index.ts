import en from './en.json' with { type: 'json' };
import zhCN from './zh-CN.json' with { type: 'json' };

export type Lang = 'zh-CN' | 'en';
export type MessageKey = keyof typeof en;

const dicts: Record<Lang, Record<string, string>> = { 'zh-CN': zhCN, en };
let current: Lang = detectLang();

export function detectLang(explicit?: string | null): Lang {
  const raw = explicit || process.env.LC_ALL || process.env.LC_MESSAGES || process.env.LANG || '';
  return /^zh/i.test(raw) ? 'zh-CN' : 'en';
}

export function setLang(lang?: string | null): Lang {
  current = detectLang(lang);
  return current;
}

export function getLang(): Lang {
  return current;
}

export function t(key: MessageKey, vars: Record<string, string | number> = {}): string {
  const template = dicts[current][key] ?? dicts.en[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
