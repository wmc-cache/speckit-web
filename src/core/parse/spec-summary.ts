import type { Root } from 'mdast';
import { visit } from 'unist-util-visit';
import type { ClarificationMark, SpecSummary } from '../model.ts';
import { collectHeadings, nodeText, parseMarkdown } from '../markdown/ast.ts';
import { anchorForId, definedIdOf } from '../markdown/ids.ts';

const STORY_RE = /^User Story\s+(\d+)\s*[-–—:：]\s*(.+?)\s*(?:\(Priority:\s*(P\d+)\)\s*)?$/i;
export const CLARIFICATION_MARKER = '[NEEDS CLARIFICATION';

export interface SpecAnalysis {
  summary: SpecSummary;
  clarifications: { open: number; sessions: number; marks: ClarificationMark[] };
}

/** `[NEEDS CLARIFICATION…]` markers in plain text (code, inline code and HTML comments excluded). */
export function findClarificationMarks(root: Root): ClarificationMark[] {
  const marks: ClarificationMark[] = [];
  visit(root, 'text', (node) => {
    let from = 0;
    for (;;) {
      const i = node.value.indexOf(CLARIFICATION_MARKER, from);
      if (i < 0) break;
      const end = node.value.indexOf(']', i);
      const raw = node.value.slice(i + 1, end < 0 ? undefined : end);
      marks.push({
        anchor: `nc-${marks.length + 1}`,
        text: raw.replace(/^NEEDS CLARIFICATION\s*:?\s*/, '').trim(),
      });
      from = i + CLARIFICATION_MARKER.length;
    }
  });
  return marks;
}

export function analyzeSpec(text: string): SpecAnalysis {
  const root = parseMarkdown(text);
  const headings = collectHeadings(root);

  const stories: SpecSummary['stories'] = [];
  let sessions = 0;
  let inClarifications = false;
  for (const { heading } of headings) {
    if (heading.depth <= 2) inClarifications = /^Clarifications$/i.test(heading.text);
    if (heading.depth === 3 && inClarifications && /^Session\b/i.test(heading.text)) sessions++;
    const m = heading.depth === 3 ? STORY_RE.exec(heading.text) : null;
    if (m)
      stories.push({
        index: Number(m[1]),
        title: m[2].trim(),
        priority: m[3] ?? null,
        anchor: heading.anchor,
      });
  }

  const requirements: SpecSummary['requirements'] = [];
  const successCriteria: SpecSummary['successCriteria'] = [];
  const seen = new Set<string>();
  visit(root, 'listItem', (item) => {
    const id = definedIdOf(item);
    if (!id || seen.has(id) || !/^(FR|SC)-/.test(id)) return;
    seen.add(id);
    const body = nodeText(item.children[0])
      .replace(/^\s*\S+\s*[:：]?\s*/, '')
      .trim();
    (id.startsWith('FR') ? requirements : successCriteria).push({ id, anchor: anchorForId(id), text: body });
  });

  const marks = findClarificationMarks(root);
  return {
    summary: { stories, requirements, successCriteria },
    clarifications: { open: marks.length, sessions, marks },
  };
}
