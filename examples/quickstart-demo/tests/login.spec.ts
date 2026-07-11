import { by, expect, test } from '@projectcrossplay/core/test';

test('successful login flow', async ({ app }) => {
  // 1. Fill the username input field. 
  // by.testId resolves dynamically to [data-testid="username"] on web
  // and resource-id/content-desc matching 'username' on Android.
  await app.fill(by.testId('username'), 'demo');

  // 2. Fill the password input field.
  // Sensitive fields like password are automatically masked in the trace.
  await app.fill(by.testId('password'), 's3cret');

  // 3. Tap/Click the sign-in button.
  // Tap dynamically adapts: registers a browser click on web, 
  // and issues a native click event on mobile.
  await app.tap(by.testId('login-button'));

  // 4. Verify that the welcome greeting is visible and contains expected text.
  // The assertion engine automatically awaits the element state, 
  // resolving any temporary spinner animations or state loading delays.
  expect(await app.getText(by.testId('greeting'))).toContain('Welcome back, demo!');
});

test('login rejects invalid credentials', async ({ app }) => {
  await app.fill(by.testId('username'), 'demo');
  await app.fill(by.testId('password'), 'incorrect-password');
  await app.tap(by.testId('login-button'));

  // Assert that the error notification appears and displays warning text.
  expect(await app.getText(by.testId('login-error'))).toContain('Wrong username or password');
});
