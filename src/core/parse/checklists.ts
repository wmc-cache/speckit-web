import type { ChecklistStats } from '../model.ts';
import { collectCheckboxItems, parseMarkdown } from '../markdown/ast.ts';

/** Same counting rule as tasks. */
export function parseChecklist(docId: string, name: string, text: string): ChecklistStats {
  const items = collectCheckboxItems(parseMarkdown(text));
  const total = items.length;
  const checked = items.filter((i) => i.checked).length;
  return { docId, name, total, checked, allPassed: total > 0 && checked === total };
}
