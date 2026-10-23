import type { IntegrationInfo } from '../core/model.ts';
import snapshot from './integrations.snapshot.json' with { type: 'json' };
import { runSpecify, type Runner } from './runner.ts';

export const DEFAULT_INTEGRATION = 'claude';

/** Parses the Rich table printed by `specify integration list` (rows may wrap onto continuation lines). */
export function parseIntegrationTable(output: string): IntegrationInfo[] {
  const rows: IntegrationInfo[] = [];
  for (const line of output.split('\n')) {
    if (!line.startsWith('│')) continue;
    const cells = line
      .split('│')
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length < 4) continue;
    const [key, name, , cli] = cells;
    if (key) rows.push({ key, name, requiresCli: cli.startsWith('yes') });
    else if (rows.length && name) rows[rows.length - 1].name += ` ${name}`;
  }
  return rows.filter((r) => /^[a-z0-9][a-z0-9-]*$/.test(r.key));
}

export function snapshotIntegrations(): IntegrationInfo[] {
  return snapshot.integrations;
}

/** Snapshot plus anything newer reported by the local specify (silently falls back to the snapshot). */
export async function listIntegrations(
  runner: Runner | null,
  env?: NodeJS.ProcessEnv,
): Promise<IntegrationInfo[]> {
  const list = [...snapshotIntegrations()];
  if (runner?.kind !== 'specify') return list;
  try {
    const r = await runSpecify(runner, ['integration', 'list'], { env });
    const known = new Set(list.map((i) => i.key));
    for (const i of parseIntegrationTable(r.output)) if (!known.has(i.key)) list.push(i);
  } catch {
    // keep the snapshot
  }
  return list.sort((a, b) => a.key.localeCompare(b.key));
}
