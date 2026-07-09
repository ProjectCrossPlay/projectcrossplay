/**
 * The shared demo spec (FR-070): zero platform branching. The same file will
 * run against the Android demo apps once driver-android lands (Sprint 3) —
 * only the target changes.
 */
import { by, expect, test, type App } from '@projectcrossplay/core/test';

async function login(app: App): Promise<void> {
  await app.fill(by.testId('username'), 'demo', { mask: false });
  await app.fill(by.testId('password'), 'crossplay');
  await app.tap(by.role('button', { name: 'Sign in' }));
}

test('login flow', async ({ app }) => {
  await login(app);
  // The spinner takes ~400ms — auto-wait absorbs it, no sleep() anywhere (FR-040).
  await app.waitFor(by.testId('greeting'));
  expect(await app.getText(by.testId('greeting'))).toContain('Welcome back');
});

test('login rejects bad credentials', async ({ app }) => {
  await app.fill(by.testId('username'), 'demo', { mask: false });
  await app.fill(by.testId('password'), 'wrong-password');
  await app.tap(by.role('button', { name: 'Sign in' }));
  expect(await app.getText(by.testId('login-error'))).toContain('Wrong username or password');
});

test('list/detail', async ({ app }) => {
  await login(app);
  // Rows fade in one by one; the last row is the flake trap (FR-041).
  await app.tap(by.testId('item-row-5'));
  expect(await app.getText(by.testId('detail-title'))).toBe('Doctor Kit');
  expect(await app.getText(by.testId('detail-price'))).toBe('$9');
  await app.tap(by.testId('back-button'));
  await app.waitFor(by.testId('item-list'));
});
