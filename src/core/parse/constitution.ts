import type { Constitution } from '../model.ts';
import { firstH1, parseMarkdown } from '../markdown/ast.ts';

// Template placeholders look like `[PROJECT_NAME]`, `[PRINCIPLE_1_NAME]`.
const PLACEHOLDER_RE = /\[[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\]|\[[A-Z]{4,}\]/;

function field(text: string, label: string): string | null {
  const m = new RegExp(`\\*\\*${label}\\*\\*\\s*:\\s*([^|\\n]+)`).exec(text);
  const v = m?.[1].trim();
  return v ? v : null;
}

export function parseConstitution(docId: string, text: string): Constitution {
  return {
    docId,
    filled: !PLACEHOLDER_RE.test(text),
    title: firstH1(parseMarkdown(text)),
    version: field(text, 'Version'),
    ratified: field(text, 'Ratified'),
    lastAmended: field(text, 'Last Amended'),
  };
}
