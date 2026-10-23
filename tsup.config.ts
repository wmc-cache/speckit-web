import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { cli: 'src/cli/index.ts' },
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  outDir: 'dist',
  clean: false,
  splitting: false,
  sourcemap: false,
  banner: { js: '#!/usr/bin/env node' },
});
