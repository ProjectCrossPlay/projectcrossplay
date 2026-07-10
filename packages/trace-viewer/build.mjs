#!/usr/bin/env node
/**
 * Bundles the viewer into dist/ as a fully self-contained set of static
 * assets (single JS bundle, single CSS file, one HTML entry) — no CDN
 * fonts/scripts, no external requests at runtime (ADR-004, NFR-015/016).
 */
import esbuild from 'esbuild';
import { copyFile, mkdir } from 'node:fs/promises';

await mkdir('dist', { recursive: true });

await esbuild.build({
  entryPoints: ['src/main.tsx'],
  bundle: true,
  outfile: 'dist/app.js',
  format: 'iife',
  target: 'es2020',
  minify: true,
  jsx: 'automatic',
  jsxImportSource: 'preact',
  logLevel: 'info',
});

await copyFile('src/index.html', 'dist/index.html');
await copyFile('src/style.css', 'dist/style.css');
console.log('trace-viewer: dist/{index.html,app.js,style.css} written');
