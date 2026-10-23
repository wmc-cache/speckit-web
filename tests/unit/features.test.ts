import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildArtifactSlots,
  classifyFeatureDirs,
  parseFeatureDirName,
  readInitOptions,
} from '../../src/core/features.ts';
import { ProjectStore } from '../../src/core/project.ts';
import { FIXTURES } from '../fixtures/setup.ts';

describe('feature directories', () => {
  it('recognizes sequential and timestamp prefixes', () => {
    expect(parseFeatureDirName('001-user-auth')).toMatchObject({
      prefix: '001',
      numberingKind: 'sequential',
      shortName: 'user-auth',
    });
    expect(parseFeatureDirName('20260319-143022-user-auth')).toMatchObject({
      prefix: '20260319-143022',
      numberingKind: 'timestamp',
      shortName: 'user-auth',
    });
    expect(parseFeatureDirName('notes')).toBeNull();
    expect(parseFeatureDirName('12-too-short')).toBeNull();
  });

  it('sorts sequential (numerically) before timestamps and lists unrecognized dirs last', () => {
    const { features, unrecognized } = classifyFeatureDirs([
      '20260101-120000-b',
      'zz',
      '010-c',
      '002-a',
      '20250101-000000-a',
      'aa',
    ]);
    expect(features.map((f) => f.id)).toEqual(['002-a', '010-c', '20250101-000000-a', '20260101-120000-b']);
    expect(unrecognized).toEqual(['aa', 'zz']);
  });

  it('marks missing standard artifacts and collects extra docs', () => {
    const ref = (p: string) => ({
      id: p,
      path: `specs/001-x/${p}`,
      title: p,
      kind: 'other' as const,
      updatedAt: '',
    });
    const { artifacts, extraDocs } = buildArtifactSlots('001-x', [
      ref('spec.md'),
      ref('checklists/a.md'),
      ref('checklists/b.md'),
      ref('notes.md'),
    ]);
    expect(artifacts.map((a) => [a.kind, a.status, a.docs.length])).toEqual([
      ['spec', 'present', 1],
      ['plan', 'missing', 0],
      ['research', 'missing', 0],
      ['data-model', 'missing', 0],
      ['contracts', 'missing', 0],
      ['quickstart', 'missing', 0],
      ['tasks', 'missing', 0],
      ['checklists', 'present', 2],
    ]);
    expect(extraDocs.map((d) => d.id)).toEqual(['notes.md']);
  });

  it('falls back from feature_numbering to branch_numbering and from integration to ai', () => {
    expect(readInitOptions(path.join(FIXTURES, 'timestamp-numbering'))).toEqual({
      specKitVersion: null,
      integration: 'copilot',
      script: 'ps',
      featureNumbering: 'timestamp',
    });
    expect(readInitOptions(path.join(FIXTURES, 'not-speckit')).featureNumbering).toBe('sequential');
  });

  it('builds the project: order, current feature, titles, unrecognized dirs', () => {
    const store = new ProjectStore(path.join(FIXTURES, 'basic'));
    const p = store.getProject();
    if (p.status !== 'OK') throw new Error('expected OK');
    expect(p.features.map((f) => f.id)).toEqual(['001-alpha', '002-beta']);
    expect(p.features[0].title).toBe('Alpha Browser');
    expect(p.currentFeatureId).toBe('001-alpha');
    expect(p.unrecognizedDirs).toEqual(['notes']);
    expect(p.constitution).toMatchObject({
      filled: true,
      version: '1.2.0',
      ratified: '2026-01-01',
      lastAmended: '2026-02-01',
    });
  });

  it('reports unfilled constitutions', () => {
    const p = new ProjectStore(path.join(FIXTURES, 'unfilled-constitution')).getProject();
    expect(p.status === 'OK' && p.constitution?.filled).toBe(false);
  });
});
