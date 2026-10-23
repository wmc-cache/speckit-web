import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ChangeEvent } from '../../src/core/model.ts';
import { ProjectStore } from '../../src/core/project.ts';
import { createApp, EventHub } from '../../src/server/app.ts';
import { mountInitRoutes } from '../../src/server/init-routes.ts';
import { ensureWebRoot, PORT, TOKEN, type JsonResponse } from './helpers.ts';
import { fakeEnv, tmpDir } from './init-helpers.ts';

let savedPath: string | undefined;
beforeEach(() => {
  savedPath = process.env.PATH;
  process.env.PATH = fakeEnv().PATH;
});
afterEach(() => {
  process.env.PATH = savedPath;
  delete process.env.SPECIFY_FAKE_FAIL;
});

function setup(root = tmpDir()) {
  const store = new ProjectStore(root);
  const events = new EventHub();
  const seen: ChangeEvent[] = [];
  events.on((e) => seen.push(e));
  let rootChanges = 0;
  const app = createApp({
    store,
    events,
    port: () => PORT,
    token: TOKEN,
    webRoot: ensureWebRoot(),
    startRoot: root,
    routes: (a) =>
      mountInitRoutes(a, { store, events, startRoot: root, token: TOKEN, onRootChange: () => rootChanges++ }),
  });
  const req = (method: string, url: string, body?: unknown, token: string | null = TOKEN) =>
    app.request(url, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: {
        host: `localhost:${PORT}`,
        'content-type': 'application/json',
        ...(token === null ? {} : { 'x-speckit-web-token': token }),
      },
    }) as Promise<JsonResponse>;
  return { root, store, seen, req, rootChanges: () => rootChanges };
}

const body = (target: unknown = { kind: 'here' }) => ({
  target,
  integration: 'claude',
  script: 'sh',
  featureNumbering: 'sequential',
});

describe('init API', () => {
  it('GET /api/init/options lists the runner, integrations and defaults', async () => {
    const { req } = setup();
    const j = await (await req('GET', '/api/init/options')).json();
    expect(j.runner).toMatchObject({ kind: 'specify', version: '0.16.4-fake' });
    expect(j.integrations.some((i: { key: string }) => i.key === 'claude')).toBe(true);
    expect(j.integrations.some((i: { key: string }) => i.key === 'fakeagent')).toBe(true);
    expect(j.defaults).toMatchObject({
      integration: 'claude',
      featureNumbering: 'sequential',
      target: { kind: 'here' },
    });
    expect(j.targetState).toBe('empty');
  });

  it('rejects writes without the token', async () => {
    const { req } = setup();
    for (const token of [null, 'wrong']) {
      const res = await req('POST', '/api/init/plan', body(), token);
      expect(res.status).toBe(403);
      expect((await res.json()).error).toBe('BAD_TOKEN');
    }
  });

  it('validates options with per-field errors', async () => {
    const { req } = setup();
    const res = await req('POST', '/api/init/plan', {
      target: { kind: 'new', name: '../x' },
      integration: '',
      script: 'bat',
      featureNumbering: 'x',
    });
    expect(res.status).toBe(400);
    const j = await res.json();
    expect(j.error).toBe('INVALID_OPTIONS');
    expect(Object.keys(j.fields).sort()).toEqual(['featureNumbering', 'integration', 'script', 'target']);
  });

  it('returns 412 PREREQ_MISSING without specify/uvx', async () => {
    const { req } = setup();
    process.env.PATH = fakeEnv(false).PATH;
    const res = await req('POST', '/api/init/plan', body());
    expect(res.status).toBe(412);
  });

  it('returns 500 SPECIFY_FAILED with the log tail', async () => {
    const { req } = setup();
    process.env.SPECIFY_FAKE_FAIL = '1';
    const res = await req('POST', '/api/init/plan', body());
    expect(res.status).toBe(500);
    const j = await res.json();
    expect(j.error).toBe('SPECIFY_FAILED');
    expect(j.log).toContain('something went wrong');
  });

  it('requires confirmation (409), expires plans (410) and applies in place', async () => {
    const root = tmpDir();
    fs.writeFileSync(path.join(root, 'README.md'), 'x');
    const { req, store, seen } = setup(root);
    const plan = await (await req('POST', '/api/init/plan', body())).json();
    expect(plan.requiresConfirmation).toBe(true);
    expect((await req('POST', '/api/init/apply', { planId: plan.planId })).status).toBe(409);
    const ok = await req('POST', '/api/init/apply', { planId: plan.planId, confirmOverwrite: true });
    expect(ok.status).toBe(200);
    expect((await ok.json()).status).toBe('succeeded');
    expect(store.isSpecKit).toBe(true);
    expect(seen.some((e) => e.type === 'project')).toBe(true);
    const gone = await req('POST', '/api/init/apply', { planId: plan.planId, confirmOverwrite: true });
    expect(gone.status).toBe(410);
    expect((await gone.json()).error).toBe('PLAN_EXPIRED');
  });

  it('initializing a new sub-directory switches the viewer root', async () => {
    const { req, store, rootChanges, root } = setup();
    const plan = await (await req('POST', '/api/init/plan', body({ kind: 'new', name: 'child' }))).json();
    const res = await (await req('POST', '/api/init/apply', { planId: plan.planId })).json();
    expect(res.projectRoot).toBe('child');
    expect(store.root).toBe(path.join(root, 'child'));
    expect(rootChanges()).toBe(1);
  });

  it('cancel discards the plan', async () => {
    const { req } = setup();
    const plan = await (await req('POST', '/api/init/plan', body())).json();
    expect((await req('POST', '/api/init/cancel', { planId: plan.planId })).status).toBe(204);
    expect((await req('POST', '/api/init/apply', { planId: plan.planId })).status).toBe(410);
  });
});

it('rejects padded traversal and linked initialization targets', async () => {
  const { root, req } = setup();
  expect((await req('POST', '/api/init/plan', body({ kind: 'new', name: ' .. ' }))).status).toBe(400);
  const outside = tmpDir();
  fs.symlinkSync(outside, path.join(root, 'child'), 'dir');
  expect((await req('POST', '/api/init/plan', body({ kind: 'new', name: 'child' }))).status).toBe(400);
  expect(fs.readdirSync(outside)).toEqual([]);
});
it('expires a plan when target contents change after preview', async () => {
  const { root, req } = setup();
  const plan = await (await req('POST', '/api/init/plan', body())).json();
  fs.writeFileSync(path.join(root, 'user.txt'), 'KEEP');
  const res = await req('POST', '/api/init/apply', { planId: plan.planId, confirmOverwrite: true });
  expect(res.status).toBe(410);
  expect(fs.readFileSync(path.join(root, 'user.txt'), 'utf8')).toBe('KEEP');
  expect(fs.existsSync(path.join(root, '.specify'))).toBe(false);
});
