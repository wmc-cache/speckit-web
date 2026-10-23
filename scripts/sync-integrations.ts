// Refreshes src/init/integrations.snapshot.json from the locally installed `specify` CLI.
// Run before each release: pnpm sync-integrations
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseIntegrationTable } from '../src/init/integrations.ts';
import { detectRunner, runSpecify } from '../src/init/runner.ts';

const out = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src/init/integrations.snapshot.json',
);
const runner = await detectRunner();
if (runner?.kind !== 'specify') {
  console.error('specify is not installed; see README for installation.');
  process.exit(1);
}
const result = await runSpecify(runner, ['integration', 'list']);
const integrations = parseIntegrationTable(result.output).sort((a, b) => a.key.localeCompare(b.key));
if (!integrations.length) {
  console.error('Could not parse `specify integration list` output:\n' + result.output);
  process.exit(1);
}
fs.writeFileSync(
  out,
  `${JSON.stringify({ source: `specify integration list (specify-cli ${runner.version ?? 'unknown'})`, integrations }, null, 2)}\n`,
);
console.log(`Wrote ${integrations.length} integrations to ${path.relative(process.cwd(), out)}`);
