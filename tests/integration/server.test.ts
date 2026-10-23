import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { docIdFor } from '../../src/core/scan.ts';
import { findPort } from '../../src/server/port.ts';
import { cleanupFixtures, copyFixture, FIXTURES } from '../fixtures/setup.ts';
import { makeApp, TOKEN } from './helpers.ts';

afterAll(cleanupFixtures);

describe('local data API', () => {
  const { get } = makeApp(path.join(FIXTURES, 'basic'));

  it('GET /api/project returns the project with status OK and no-store caching', async () => {
    const res = await get('/api/project');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = await res.json();
    expect(body.status).toBe('OK');
    expect(body.mode).toBe('local');
    expect(body.features.map((f: { id: string }) => f.id)).toEqual(['001-alpha', '002-beta']);
  });

  it('GET /api/project reports NOT_SPECKIT_PROJECT for plain directories', async () => {
    const { get: g } = makeApp(path.join(FIXTURES, 'not-speckit'));
    expect(await (await g('/api/project')).json()).toEqual({
      status: 'NOT_SPECKIT_PROJECT',
      name: 'not-speckit',
      canInit: true,
      mode: 'local',
    });
  });

  it('GET /api/features/:id returns the feature or 404 FEATURE_NOT_FOUND', async () => {
    const ok = await (await get('/api/features/001-alpha')).json();
    expect(ok.artifacts.find((a: { kind: string }) => a.kind === 'research').status).toBe('missing');
    const res = await get('/api/features/999-nope');
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('FEATURE_NOT_FOUND');
  });

  it('GET /api/docs/:id returns a rendered document', async () => {
    const doc = await (await get(`/api/docs/${docIdFor('specs/001-alpha/spec.md')}`)).json();
    expect(doc.title).toBe('Feature Specification: Alpha Browser');
    expect(doc.outline.length).toBeGreaterThan(3);
    expect(doc.html).toContain(`href="#/d/${docIdFor('specs/001-alpha/plan.md')}?h=summary"`);
  });

  it('GET /api/docs/:id?part=k serves later parts of large documents', async () => {
    const root = copyFixture('basic');
    fs.writeFileSync(
      path.join(root, 'specs/001-alpha/big.md'),
      '# Big\n\n' + 'x'.repeat(200) + '\n'.repeat(1) + 'line\n'.repeat(300000),
    );
    const { get: g } = makeApp(root);
    const id = docIdFor('specs/001-alpha/big.md');
    const first = await (await g(`/api/docs/${id}`)).json();
    expect(first.truncated).toBe(true);
    const second = await (await g(`/api/docs/${id}?part=1`)).json();
    expect(second.part).toBe(1);
    expect((await g(`/api/docs/${id}?part=9`)).status).toBe(404);
  });

  it('injects the local mode and token into the index page', async () => {
    const html = await (await get('/')).text();
    expect(html).toContain('<meta name="speckit-web-mode" content="local"');
    expect(html).toContain(`<meta name="speckit-web-token" content="${TOKEN}"`);
  });
});

describe('findPort', () => {
  it('increments when the preferred port is busy', async () => {
    const blocker = net.createServer();
    const busy = await new Promise<number>((resolve) =>
      blocker.listen(0, '127.0.0.1', () => resolve((blocker.address() as net.AddressInfo).port)),
    );
    try {
      const port = await findPort(busy);
      expect(port).toBeGreaterThan(busy);
      expect(port).toBeLessThanOrEqual(busy + 20);
    } finally {
      blocker.close();
    }
  });
});

describe('search API', () => {
  const { get } = makeApp(path.join(FIXTURES, 'basic'));
  it('GET /api/search returns hits and rejects empty queries', async () => {
    const r = await (await get('/api/search?q=alpha')).json();
    expect(r.total).toBeGreaterThan(0);
    expect(r.hits[0]).toHaveProperty('snippet');
    const empty = await get('/api/search?q=%20%20');
    expect(empty.status).toBe(400);
    expect((await empty.json()).error).toBe('EMPTY_QUERY');
  });
});
