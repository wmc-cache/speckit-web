import path from 'node:path';
import fs from 'node:fs';
import type { InitOptions, InitPlan, InitTarget, NumberingKind, ScriptKind } from '../core/model.ts';
import { t, type MessageKey } from '../i18n/index.ts';
import { applyPlan, InitApplyError, nextSteps } from '../init/apply.ts';
import { listIntegrations } from '../init/integrations.ts';
import { defaultOptions, validateOptions } from '../init/options.ts';
import { createPlan, discardPlan, InitError, type PlanEntry } from '../init/plan.ts';
import { detectRunner, installHint } from '../init/runner.ts';
import { CliError, EXIT } from './exit-codes.ts';
import { askConfirm, askIntegration, askNumbering, askScript, askTarget, p } from './prompts.ts';

interface InitFlags {
  here?: boolean;
  integration?: string;
  script?: string;
  numbering?: string;
  yes?: boolean;
  force?: boolean;
  dryRun?: boolean;
  open?: boolean;
  json?: boolean;
}

function printPlan(plan: InitPlan, cwd: string) {
  const count = (a: string) => plan.files.filter((f) => f.action === a).length;
  const target = path.relative(cwd, plan.targetPath) || '.';
  console.log(
    t('init.planHeader', {
      create: count('create'),
      overwrite: count('overwrite'),
      unchanged: count('unchanged'),
      target,
    }),
  );
  const mark = { create: '+', overwrite: '!', unchanged: '=' } as const;
  for (const f of plan.files) if (f.action !== 'unchanged') console.log(`  ${mark[f.action]} ${f.path}`);
}

export async function runInit(name: string | undefined, flags: InitFlags): Promise<void> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.once('SIGINT', cancel);
  process.once('SIGTERM', cancel);
  let cleanup: PlanEntry | undefined;
  try {
    const cwd = fs.realpathSync(process.cwd());
    const interactive = !!process.stdin.isTTY && !!process.stdout.isTTY && !flags.json;
    const ask = interactive && !flags.yes;
    const defaults = defaultOptions('cli');

    if (name && flags.here)
      throw new CliError(
        t('err.badArgs', { msg: '[name] and --here are mutually exclusive' }),
        EXIT.BAD_ARGS,
      );
    if (ask) p.intro(t('init.intro'));

    const runner = await detectRunner();
    if (!runner) {
      const hint = installHint();
      console.error(`✖ ${t('init.prereqMissing')}`);
      console.error(`  ${t('init.installUv')}\n    ${hint.uv}`);
      console.error(`  ${t('init.installSpecify')}\n    ${hint.specify}`);
      throw new CliError('', EXIT.PREREQ_MISSING);
    }
    if (!flags.json)
      console.log(
        t('init.runner', {
          runner: `${runner.kind === 'uvx' ? 'uvx specify' : 'specify'}${runner.version ? ` ${runner.version}` : ''}`,
        }),
      );

    let target: InitTarget | null = flags.here ? { kind: 'here' } : name ? { kind: 'new', name } : null;
    if (!target) {
      if (!ask) throw new CliError(t('init.missingTarget'), EXIT.BAD_ARGS);
      target = await askTarget();
    }
    const integration =
      flags.integration ??
      (ask
        ? await askIntegration(await listIntegrations(runner), defaults.integration)
        : defaults.integration);
    const script = (flags.script ?? (ask ? await askScript(defaults.script) : defaults.script)) as ScriptKind;
    const featureNumbering = (flags.numbering ??
      (ask ? await askNumbering(defaults.featureNumbering) : defaults.featureNumbering)) as NumberingKind;

    const valid = validateOptions({ target, integration, script, featureNumbering });
    if (!valid.ok)
      throw new CliError(
        t('err.badArgs', {
          msg: Object.values(valid.fields)
            .map((key) => t(key as MessageKey))
            .join('; '),
        }),
        EXIT.BAD_ARGS,
      );
    const options: InitOptions = valid.options;

    const spin = ask ? p.spinner() : null;
    spin?.start(t('init.staging'));
    let planned: Awaited<ReturnType<typeof createPlan>>;
    try {
      planned = await createPlan(options, cwd, runner, process.env, controller.signal);
    } catch (err) {
      spin?.stop(t('init.failed', { msg: '' }));
      if (err instanceof InitError) {
        if (err.log) console.error(err.log);
        throw new CliError(
          t('init.failed', {
            msg: err.message.startsWith('init.error.') ? t(err.message as MessageKey) : err.message,
          }),
          err.code === 'INVALID_OPTIONS' ? EXIT.BAD_ARGS : EXIT.RUNTIME_ERROR,
        );
      }
      throw err;
    }
    spin?.stop(t('init.staging'));
    const { plan, entry } = planned;
    cleanup = entry;
    if (controller.signal.aborted) throw new CliError(t('init.cancelled'), EXIT.CANCELLED);

    if (flags.dryRun) {
      if (flags.json) console.log(JSON.stringify(plan));
      else printPlan(plan, cwd);
      discardPlan(entry);
      return;
    }

    if (plan.requiresConfirmation) {
      if (!flags.json) printPlan(plan, cwd);
      if (!flags.force) {
        if (!ask) {
          if (flags.json) console.log(JSON.stringify(plan));
          discardPlan(entry);
          throw new CliError(t('init.needForce'), EXIT.RUNTIME_ERROR);
        }
        if (!(await askConfirm())) {
          discardPlan(entry);
          p.cancel(t('init.cancelled'));
          throw new CliError('', EXIT.CANCELLED);
        }
      }
    }

    try {
      await applyPlan(entry);
    } catch (err) {
      if (err instanceof InitApplyError) {
        console.error(
          t('init.failed', {
            msg: err.message.startsWith('init.error.') ? t(err.message as MessageKey) : err.message,
          }),
        );
        if (err.rolledBack) console.error(t('init.rolledBack'));
        else console.error(`${t('init.leftovers')}\n  ${err.leftovers.join('\n  ')}`);
        throw new CliError('', EXIT.RUNTIME_ERROR);
      }
      throw err;
    }

    const rel = path.relative(cwd, plan.targetPath);
    const steps = nextSteps(rel && rel !== '.' ? rel : null).map((s) => t(s.key as MessageKey, s.vars));
    if (flags.json) {
      console.log(JSON.stringify({ status: 'succeeded', targetPath: plan.targetPath, nextSteps: steps }));
    } else {
      const version = plan.runner.version ?? '?';
      console.log(
        `✔ ${t('init.done', { target: rel || '.', version, integration: options.integration, script: options.script })}`,
      );
      console.log(t('init.next'));
      steps.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
      if (ask) p.outro('');
    }

    if (flags.open) {
      const { runServe } = await import('./serve.ts');
      await runServe(plan.targetPath, { port: 5178, open: true });
    }
  } catch (error) {
    if (controller.signal.aborted) throw new CliError(t('init.cancelled'), EXIT.CANCELLED);
    throw error;
  } finally {
    if (cleanup) discardPlan(cleanup);
    process.removeListener('SIGINT', cancel);
    process.removeListener('SIGTERM', cancel);
  }
}
