import type { Task, TaskStats } from '../model.ts';
import { collectCheckboxItems, parseMarkdown } from '../markdown/ast.ts';
import { anchorForId } from '../markdown/ids.ts';

const PHASE_RE = /^Phase\s+(\d+)\s*[:：]\s*(.*)$/i;
const ID_RE = /^(T\d{3,})\b/;
const STORY_RE = /\[(US\d+)\]/i;
const PARALLEL_RE = /\[P\]/;

/**
 * Counting rule: every GFM task-list item (`-`/`*`/`+` followed by `[ ]`, `[x]` or `[X]`, indentation allowed);
 * items inside code blocks or HTML comments are not list items and therefore never counted.
 */
export function parseTasks(docId: string, text: string): { stats: TaskStats; items: Task[] } {
  const seen = new Set<string>();
  const items: Task[] = collectCheckboxItems(parseMarkdown(text)).map((c) => {
    const id = ID_RE.exec(c.text)?.[1] ?? null;
    const pm = c.h2 ? PHASE_RE.exec(c.h2) : null;
    const anchor = id && !seen.has(id) ? anchorForId(id) : null;
    if (id) seen.add(id);
    return {
      id,
      text: c.text,
      done: c.checked,
      parallel: PARALLEL_RE.test(c.text),
      story: STORY_RE.exec(c.text)?.[1].toUpperCase() ?? null,
      phase: pm ? { index: Number(pm[1]), title: pm[2].trim() } : null,
      anchor,
    };
  });

  const byPhase = new Map<number, { index: number; title: string; total: number; done: number }>();
  const byStory = new Map<string | null, { story: string | null; total: number; done: number }>();
  for (const it of items) {
    if (it.phase) {
      const p = byPhase.get(it.phase.index) ?? {
        index: it.phase.index,
        title: it.phase.title,
        total: 0,
        done: 0,
      };
      p.total++;
      if (it.done) p.done++;
      byPhase.set(it.phase.index, p);
    }
    const s = byStory.get(it.story) ?? { story: it.story, total: 0, done: 0 };
    s.total++;
    if (it.done) s.done++;
    byStory.set(it.story, s);
  }
  const storyOrder = (s: string | null) => (s === null ? Number.MAX_SAFE_INTEGER : Number(s.slice(2)));
  return {
    items,
    stats: {
      docId,
      total: items.length,
      done: items.filter((i) => i.done).length,
      byPhase: [...byPhase.values()].sort((a, b) => a.index - b.index),
      byStory: [...byStory.values()].sort((a, b) => storyOrder(a.story) - storyOrder(b.story)),
    },
  };
}
