import path from 'node:path';
import type { Hono } from 'hono';
import type { ProjectStore } from '../core/project.ts';
import { applyPlan, InitApplyError, nextSteps } from '../init/apply.ts';
import { listIntegrations } from '../init/integrations.ts';
import { defaultOptions, validateOptions } from '../init/options.ts';
import { createPlan, InitError, PlanStore, targetStateOf } from '../init/plan.ts';
import { detectRunner, installHint } from '../init/runner.ts';
import { apiError, type EventHub } from './app.ts';

export interface InitRouteOptions {
  store: ProjectStore;
  events: EventHub;
  startRoot: string;
  token: string;
  onRootChange?: (root: string) => void;
}

/** Web-wizard endpoints (contracts/data-api.md `/api/init/*`). The only write path of the viewer. */
export function mountInitRoutes(app: Hono, opts: InitRouteOptions): void {
  const { store, events, startRoot, token } = opts;
  const plans = new PlanStore();

  app.use('/api/init/*', async (c, next) => {
    if (c.req.method === 'POST' && c.req.header('x-speckit-web-token') !== token)
      return apiError(c, 403, 'BAD_TOKEN');
    await next();
  });

  app.get('/api/init/options', async (c) => {
    const runner = await detectRunner();
    const hint = installHint();
    return c.json({
      runner: runner ? { kind: runner.kind, version: runner.version } : null,
      prerequisites: [
        { name: 'specify', ok: runner?.kind === 'specify', installHint: hint.specify },
        { name: 'uvx', ok: runner !== null, installHint: hint.uv },
      ],
      integrations: await listIntegrations(runner),
      defaults: defaultOptions('web'),
      targetState: targetStateOf(startRoot),
    });
  });

  app.post('/api/init/plan', async (c) => {
    const raw = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const valid = validateOptions(raw);
    if (!valid.ok) return apiError(c, 400, 'INVALID_OPTIONS', { fields: valid.fields });
    const runner = await detectRunner();
    if (!runner) return apiError(c, 412, 'PREREQ_MISSING');
    try {
      const { plan, entry } = await createPlan(valid.options, startRoot, runner);
      plans.add(entry);
      return c.json({ ...plan, targetPath: path.relative(startRoot, plan.targetPath) || '.' });
    } catch (err) {
      if (err instanceof InitError && err.code === 'SPECIFY_FAILED')
        return apiError(c, 500, 'SPECIFY_FAILED', { log: err.log ?? '' });
      if (err instanceof InitError)
        return apiError(c, 400, 'INVALID_OPTIONS', { fields: { target: err.message } });
      throw err;
    }
  });

  app.post('/api/init/apply', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { planId?: string; confirmOverwrite?: boolean };
    const entry = body.planId ? plans.get(body.planId) : null;
    if (!entry) return apiError(c, 410, 'PLAN_EXPIRED');
    if (entry.plan.requiresConfirmation && body.confirmOverwrite !== true)
      return apiError(c, 409, 'CONFIRMATION_REQUIRED');
    plans.remove(entry.plan.planId, false);
    try {
      await applyPlan(entry);
    } catch (err) {
      if (err instanceof InitApplyError)
        return apiError(c, 500, 'APPLY_FAILED', { rolledBack: err.rolledBack, leftovers: err.leftovers });
      throw err;
    }
    const isNew = entry.options.target.kind === 'new';
    if (isNew) {
      store.setRoot(entry.targetPath);
      opts.onRootChange?.(entry.targetPath);
    } else {
      store.load();
    }
    events.emit({ type: 'project', docIds: [], at: new Date().toISOString() });
    return c.json({
      status: 'succeeded',
      projectRoot: path.relative(startRoot, entry.targetPath) || '.',
      nextSteps: nextSteps(null),
    });
  });

  app.post('/api/init/cancel', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { planId?: string };
    if (body.planId) plans.remove(body.planId);
    return c.body(null, 204);
  });
}
