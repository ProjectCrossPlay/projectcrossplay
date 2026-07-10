# Selectors

`by.*` is the only way test code builds a selector. Every selector is a plain, serializable value — the same selector object is handed to whichever driver is active, and each driver maps it to that platform's native query. Nothing about a spec's selectors changes when you switch `--target`.

```ts
import { by } from '@projectcrossplay/core';

by.testId('login-button');
by.text('Sign in');
by.text('Sign', { exact: false }); // substring match
by.role('button', { name: 'Sign in' });
```

## `by.testId(value)`

The one selector kind to prefer when you control the app's markup — it's the most stable across UI redesigns.

| Platform | Maps to |
|---|---|
| Web | `[data-testid="value"]` |
| Android | **both** `resource-id` (exact match, qualified or not) and `content-desc`, queried together — React Native puts `testID` in different places depending on version/config, so both are checked and the results merged |

Android `R.id` resource names only allow `[a-z0-9_]` — no hyphens. Pick underscore_case test IDs if you want the same literal string to double as an Android resource id (`login_button`, not `login-button`).

## `by.text(value, { exact? })`

Matches visible/rendered text. `exact` defaults to `true` (whole-string match); pass `{ exact: false }` for substring matching.

| Platform | Maps to |
|---|---|
| Web | Playwright `getByText` |
| Android | `UiSelector.text(...)` (exact) or `.textContains(...)` (substring) |

## `by.role(role, { name? })`

Semantic role, optionally narrowed by an accessible name. Defined roles: `button`, `textbox`, `checkbox`, `switch`, `link`, `image`, `heading`, `listitem`.

| Platform | Maps to |
|---|---|
| Web | Playwright `getByRole` (ARIA) — `image` maps to ARIA's `img` |
| Android | The matching widget class (`Button` → `android.widget.Button`, `textbox` → `android.widget.EditText`, `checkbox` → `CheckBox`, `switch` → `Switch`, `link` → a clickable `TextView` — Android has no dedicated link widget, `image` → `ImageView`, `heading` → `TextView`, `listitem` → `ViewGroup`, matching a RecyclerView row); `name` is checked against both the widget's `text` **and** its `content-desc`, since React Native flattens child text into the description on accessible containers |

Prefer `by.testId` for list rows (`listitem`) — a bare `ViewGroup` class match is broad.

## Ambiguity and absence

Every action (`tap`, `fill`, `getText`, `waitFor`) auto-waits: it polls the driver with adaptive backoff until the element is present, visible, stable, and enabled, or the timeout (`crossplay.config.ts`'s `timeout`, default 30s) elapses. Two failure modes have dedicated errors, both following the same three-part shape (what went wrong / why / what to try next):

- **Timeout** — nothing matched (or matched but never became actionable) within the budget.
- **Ambiguity** — more than one element matched and the action can't pick for you. Narrow the selector (add `{ name }`, switch to `by.testId`, etc.) rather than relying on selector order — order isn't part of the contract.

Drivers never resolve ambiguity or wait internally; that policy lives in core so it's identical on every platform.
