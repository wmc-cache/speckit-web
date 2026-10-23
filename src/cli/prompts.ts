import * as p from '@clack/prompts';
import type { IntegrationInfo, InitTarget, NumberingKind, ScriptKind } from '../core/model.ts';
import { t, type MessageKey } from '../i18n/index.ts';
import { nameError } from '../init/options.ts';
import { CliError, EXIT } from './exit-codes.ts';

const OTHER = '__other__';

function guard<T>(value: T): Exclude<T, symbol> {
  if (p.isCancel(value)) {
    p.cancel(t('init.cancelled'));
    throw new CliError('', EXIT.CANCELLED);
  }
  return value as Exclude<T, symbol>;
}

export async function askTarget(): Promise<InitTarget> {
  const kind = guard(
    await p.select({
      message: t('init.askTarget'),
      options: [
        { value: 'new', label: t('init.targetNew') },
        { value: 'here', label: t('init.targetHere') },
      ],
    }),
  );
  if (kind === 'here') return { kind: 'here' };
  const name = guard(
    await p.text({
      message: t('init.askName'),
      validate: (v) => (nameError(v) ? t(nameError(v) as MessageKey) : undefined),
    }),
  );
  return { kind: 'new', name: name.trim() };
}

export async function askIntegration(list: IntegrationInfo[], initial: string): Promise<string> {
  const choice = guard(
    await p.autocomplete({
      message: t('init.askIntegration'),
      options: [
        ...list.map((i) => ({ value: i.key, label: i.name, hint: i.key })),
        { value: OTHER, label: t('init.other') },
      ],
      initialValue: initial,
      maxItems: 10,
    }),
  );
  if (choice !== OTHER) return choice;
  return guard(
    await p.text({ message: t('init.askOtherKey'), validate: (v) => (v?.trim() ? undefined : 'required') }),
  ).trim();
}

export async function askScript(initial: ScriptKind): Promise<ScriptKind> {
  return guard(
    await p.select({
      message: t('init.askScript'),
      initialValue: initial,
      options: [
        { value: 'sh' as const, label: 'sh (bash/zsh)' },
        { value: 'ps' as const, label: 'PowerShell' },
        { value: 'py' as const, label: 'Python' },
      ],
    }),
  );
}

export async function askNumbering(initial: NumberingKind): Promise<NumberingKind> {
  return guard(
    await p.select({
      message: t('init.askNumbering'),
      initialValue: initial,
      options: [
        { value: 'sequential' as const, label: t('init.numSequential') },
        { value: 'timestamp' as const, label: t('init.numTimestamp') },
      ],
    }),
  );
}

export async function askConfirm(): Promise<boolean> {
  return guard(await p.confirm({ message: t('init.confirmOverwrite'), initialValue: false }));
}

export { p };
