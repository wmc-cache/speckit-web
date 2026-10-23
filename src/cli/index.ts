import { cac } from 'cac';
import { setLang, t } from '../i18n/index.ts';
import { packageVersion } from '../paths.ts';
import { CliError, EXIT } from './exit-codes.ts';

// Language must be known before help texts are built.
const langIdx = process.argv.findIndex((a) => a === '--lang' || a.startsWith('--lang='));
setLang(langIdx >= 0 ? (process.argv[langIdx].split('=')[1] ?? process.argv[langIdx + 1]) : null);

const cli = cac('speckit-web');
cli.option('--lang <lang>', t('opt.lang'));

cli
  .command('[dir]', t('cli.serve'))
  .option('--port <n>', t('opt.port'), { default: 5178 })
  .option('--open', t('opt.open'), { default: true })
  .action(async (dir: string | undefined, opts: { port: number | string; open: boolean }) => {
    const { runServe } = await import('./serve.ts');
    await runServe(dir ?? '.', { port: Number(opts.port), open: opts.open });
  });

cli
  .command('build [dir]', t('cli.build'))
  .option('--out <path>', t('opt.out'))
  .option('--title <text>', t('opt.title'))
  .option('--json', t('opt.json'))
  .action(async (dir: string | undefined, opts: { out?: string; title?: string; json?: boolean }) => {
    const { runBuild } = await import('./build.ts');
    await runBuild(dir ?? '.', opts);
  });

cli
  .command('init [name]', t('cli.init'))
  .option('--here', t('opt.here'))
  .option('--integration <key>', t('opt.integration'))
  .option('--script <type>', t('opt.script'))
  .option('--numbering <kind>', t('opt.numbering'))
  .option('-y, --yes', t('opt.yes'))
  .option('--force', t('opt.force'))
  .option('--dry-run', t('opt.dryRun'))
  .option('--open', t('opt.initOpen'))
  .option('--json', t('opt.json'))
  .action(async (name: string | undefined, opts: Record<string, unknown>) => {
    const { runInit } = await import('./init.ts');
    await runInit(name, opts);
  });

cli.help();
cli.version(packageVersion());

async function main() {
  try {
    // `speckit-web serve x` is the same as `speckit-web x` (the default command).
    const argv = [...process.argv];
    if (argv[2] === 'serve') argv.splice(2, 1);
    cli.parse(argv, { run: false });
    await cli.runMatchedCommand();
  } catch (err) {
    if (err instanceof CliError) {
      if (err.message) console.error(err.message);
      process.exit(err.code);
    }
    const msg = err instanceof Error ? err.message : String(err);
    if (/unknown option|missing required|unused args/i.test(msg)) {
      console.error(t('err.badArgs', { msg }));
      process.exit(EXIT.BAD_ARGS);
    }
    console.error(msg);
    process.exit(EXIT.RUNTIME_ERROR);
  }
}

void main();
