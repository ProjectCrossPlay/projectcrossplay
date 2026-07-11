/**
 * crossplay init (FR-060, wireframe C2): scaffold config + example spec
 * (+ optional CI workflow with --ci). Existing files are never overwritten.
 */
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { OK, SKIP } from './ui.js';

const CONFIG_TEMPLATE = `import { defineConfig } from '@projectcrossplay/core';

export default defineConfig({
  targets: {
    web: {
      platform: 'web',
      use: { baseURL: 'http://localhost:3000', browser: 'chromium' },
    },
    // android: {
    //   platform: 'android',
    //   use: { apk: './app/build/outputs/apk/debug/app-debug.apk' },
    // },
  },
  timeout: 30_000,
  trace: 'on',
});
`;

const SPEC_TEMPLATE = `import { by, expect, test } from '@projectcrossplay/core/test';

// One spec, every platform: app.tap is a click on web and a tap on Android.
test('example', async ({ app }) => {
  await app.waitFor(by.role('heading'));
  // await app.fill(by.testId('username'), 'demo');
  // await app.tap(by.role('button', { name: 'Sign in' }));
  // expect(await app.getText(by.testId('greeting'))).toContain('Welcome');
});
`;

const CI_TEMPLATE = `name: CrossPlay
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx crossplay test --target web
      - uses: actions/upload-artifact@v4
        if: failure()
        with: { name: traces, path: .crossplay/traces }
`;

export interface ScaffoldResult {
  path: string;
  action: 'created' | 'skipped';
  reason?: 'ci-not-requested' | 'exists';
}

/**
 * Pure file-scaffolding, no console output — split out from `init()` so
 * the MCP `crossplay_scaffold` tool (B-105-07) can get structured results
 * directly. `init()`'s own console.log calls stay CLI-only: stdout is the
 * MCP transport channel, so the tool must never call `init()` itself.
 */
export async function scaffoldFiles(opts: { ci?: boolean }): Promise<ScaffoldResult[]> {
  const files: Array<[string, string, boolean]> = [
    // .mts, not .ts: Node's ESM loader treats a bare .ts file as CommonJS
    // unless the nearest package.json sets "type": "module" — exactly what
    // `npm init -y` does NOT set. .mts is unambiguous regardless (already a
    // supported config filename in global-setup.ts's CONFIG_CANDIDATES), so
    // the scaffolded config loads correctly for every project layout.
    ['crossplay.config.mts', CONFIG_TEMPLATE, true],
    [join('tests', 'example.spec.ts'), SPEC_TEMPLATE, true],
    [join('.github', 'workflows', 'crossplay.yml'), CI_TEMPLATE, opts.ci === true],
  ];
  const results: ScaffoldResult[] = [];
  for (const [rel, content, enabled] of files) {
    if (!enabled) {
      results.push({ path: rel, action: 'skipped', reason: 'ci-not-requested' });
      continue;
    }
    if (existsSync(rel)) {
      results.push({ path: rel, action: 'skipped', reason: 'exists' });
      continue;
    }
    await mkdir(dirname(rel) === '.' ? '.' : dirname(rel), { recursive: true });
    await writeFile(rel, content, 'utf8');
    results.push({ path: rel, action: 'created' });
  }
  return results;
}

export async function init(opts: { ci?: boolean }): Promise<number> {
  console.log('');
  const results = await scaffoldFiles(opts);
  for (const r of results) {
    if (r.action === 'created') {
      console.log(`  ${OK} ${r.path.padEnd(28)} created`);
    } else if (r.reason === 'exists') {
      console.log(`  ${SKIP} ${r.path} exists — skipped`);
    } else {
      console.log(`  ${SKIP} ${r.path.padEnd(28)} skipped (--ci to include)`);
    }
  }
  console.log('\nDone. Next steps:');
  console.log('  1. crossplay doctor          check your environment');
  console.log('  2. crossplay test --target=web');
  return 0;
}
