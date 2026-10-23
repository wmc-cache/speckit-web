import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ProjectStore } from '../../src/core/project.ts';
import { docIdFor } from '../../src/core/scan.ts';
import { DEMO, FIXTURES } from '../fixtures/setup.ts';

describe('cross references', () => {
  const store = new ProjectStore(DEMO);
  const specId = docIdFor('specs/002-user-login/spec.md');
  const tasksId = docIdFor('specs/002-user-login/tasks.md');

  it('creates anchors at definitions', async () => {
    const spec = await store.getDoc(specId);
    expect(spec?.anchors['FR-003']).toBe('fr-003');
    expect(spec?.html).toContain('<li id="fr-003">');
    const tasks = await store.getDoc(tasksId);
    expect(tasks?.anchors.T005).toBe('t005');
  });

  it('links references to the definition in another document of the same feature', async () => {
    const tasks = await store.getDoc(tasksId);
    expect(tasks?.html).toContain(`<a class="xref" href="#/d/${specId}?h=fr-003">FR-003</a>`);
    const dm = await store.getDoc(docIdFor('specs/002-user-login/data-model.md'));
    expect(dm?.html).toContain(`href="#/d/${specId}?h=fr-005"`);
  });

  it('does not link identifiers inside code or unknown identifiers', async () => {
    const plan = await store.getDoc(docIdFor('specs/001-alpha/plan.md'));
    expect(plan).toBeNull();
    const basic = new ProjectStore(path.join(FIXTURES, 'basic'));
    const spec = await basic.getDoc(docIdFor('specs/001-alpha/spec.md'));
    // "T900" appears only inside a code block.
    expect(spec?.html).not.toMatch(/<a class="xref"[^>]*>T900/);
    const basicPlan = await basic.getDoc(docIdFor('specs/001-alpha/plan.md'));
    expect(basicPlan?.html).toContain('class="xref"');
    expect(basicPlan?.html).toContain('>SC-001</a>');
    const tasks = await basic.getDoc(docIdFor('specs/001-alpha/tasks.md'));
    expect(tasks?.html).not.toMatch(/>T999</);
  });

  it('does not turn a definition into a link to itself', async () => {
    const spec = await store.getDoc(specId);
    expect(spec?.html).toContain('<strong>FR-003</strong>');
  });

  it('highlights open clarification markers with numbered anchors', async () => {
    const spec = await store.getDoc(specId);
    expect(spec?.clarificationMarks.map((m) => m.anchor)).toEqual(['nc-1', 'nc-2']);
    expect(spec?.html).toContain('<mark class="needs-clarification" id="nc-1">');
  });
});
