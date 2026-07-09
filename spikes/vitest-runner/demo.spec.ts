/** Spike B-003: the demo login flow written the way real CrossPlay specs will read. */
import { expect } from 'vitest';
import { test } from './crossplay-test.js';

test('login flow (shape of the real demo spec)', async ({ app }) => {
  await app.fill('testId:username', 'demo');
  await app.fill('testId:password', 's3cret');
  await app.tap('testId:login-button');
  expect(await app.getText('testId:welcome')).toContain('Welcome');
  expect(app.steps.filter((s) => s.action === 'fill').every((s) => s.masked)).toBe(true);
});

test('second test proving fixture isolation', async ({ app }) => {
  await app.tap('testId:item-row-1');
  expect(app.steps).toHaveLength(1); // fresh app per test, no bleed-through
});
