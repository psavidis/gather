// Bundles the backend into a single Apps Script file. Apps Script only sees
// top-level function declarations, so doPost is re-exposed from the bundle.
import { build } from 'esbuild';
import { copyFile, mkdir } from 'node:fs/promises';

const outdir = 'dist/backend';
await mkdir(outdir, { recursive: true });
await build({
  entryPoints: ['backend/src/main.ts'],
  outfile: `${outdir}/Code.js`,
  bundle: true,
  format: 'iife',
  globalName: 'Gather',
  target: 'es2020',
  footer: { js: 'function doPost(e) { return Gather.doPost(e); }' },
});
await copyFile('backend/appsscript.json', `${outdir}/appsscript.json`);
