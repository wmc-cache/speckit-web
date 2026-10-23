import type { InitOptions, NumberingKind, ScriptKind } from '../core/model.ts';
import { DEFAULT_INTEGRATION } from './integrations.ts';

export type InitEntry = 'cli' | 'web';
export type FieldErrors = Partial<Record<'target' | 'integration' | 'script' | 'featureNumbering', string>>;

export function defaultScript(platform: NodeJS.Platform = process.platform): ScriptKind {
  return platform === 'win32' ? 'ps' : 'sh';
}

export function defaultOptions(entry: InitEntry, platform: NodeJS.Platform = process.platform) {
  return {
    target: entry === 'web' ? ({ kind: 'here' } as const) : null,
    integration: DEFAULT_INTEGRATION,
    script: defaultScript(platform),
    featureNumbering: 'sequential' as NumberingKind,
  };
}

/** Problem with a new directory name, or null when valid. */
export function nameError(name: unknown): string | null {
  if (typeof name !== 'string' || !name.trim()) return 'init.error.nameRequired';
  const normalized = name.trim();
  if (normalized === '.' || normalized === '..') return 'init.error.nameDot';
  if (/[\\/]/.test(normalized)) return 'init.error.nameSeparator';
  if (/[\0<>:"|?*]/.test(normalized)) return 'init.error.nameInvalid';
  return null;
}

/** Validates raw input (CLI flags or JSON body) into InitOptions; both entries share these rules. */
export function validateOptions(
  raw: Record<string, unknown>,
): { ok: true; options: InitOptions } | { ok: false; fields: FieldErrors } {
  const fields: FieldErrors = {};
  const target = raw.target as { kind?: unknown; name?: unknown } | undefined;
  let parsedTarget: InitOptions['target'] | null = null;
  if (target?.kind === 'here') parsedTarget = { kind: 'here' };
  else if (target?.kind === 'new') {
    const err = nameError(target.name);
    if (err) fields.target = err;
    else parsedTarget = { kind: 'new', name: String(target.name).trim() };
  } else fields.target = 'init.error.targetInvalid';

  const integration = typeof raw.integration === 'string' ? raw.integration.trim() : '';
  if (!integration) fields.integration = 'init.error.integrationRequired';
  else if (!/^[A-Za-z0-9][\w.-]*$/.test(integration)) fields.integration = 'init.error.integrationInvalid';

  if (raw.script !== 'sh' && raw.script !== 'ps' && raw.script !== 'py')
    fields.script = 'init.error.scriptInvalid';
  if (raw.featureNumbering !== 'sequential' && raw.featureNumbering !== 'timestamp')
    fields.featureNumbering = 'init.error.numberingInvalid';

  if (Object.keys(fields).length || !parsedTarget) return { ok: false, fields };
  return {
    ok: true,
    options: {
      target: parsedTarget,
      integration,
      script: raw.script as ScriptKind,
      featureNumbering: raw.featureNumbering as NumberingKind,
    },
  };
}
