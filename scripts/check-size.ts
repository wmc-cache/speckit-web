// Fails when the published npm package would be larger than 15 MB (unpacked).
import { execFileSync } from 'node:child_process';

const LIMIT = 15 * 1024 * 1024;
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const out = execFileSync(npm, ['pack', '--dry-run', '--json'], {
  encoding: 'utf8',
  shell: process.platform === 'win32',
});
const [info] = JSON.parse(out.slice(out.indexOf('['))) as {
  unpackedSize: number;
  size: number;
  entryCount: number;
}[];
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(2)} MB`;
console.log(
  `package: ${info.entryCount} files, ${mb(info.size)} packed, ${mb(info.unpackedSize)} unpacked (limit ${mb(LIMIT)})`,
);
if (info.unpackedSize > LIMIT) {
  console.error('Package is too large.');
  process.exit(1);
}
