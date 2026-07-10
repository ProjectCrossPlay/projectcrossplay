[**CrossPlay API reference**](../../README.md)

***

[CrossPlay API reference](../../README.md) / [index](../README.md) / App

# Class: App

@projectcrossplay/core public surface (fully typed, FR-002).

This root entry is importable everywhere — config files, the CLI, driver
packages. `test`/`expect` live in '@projectcrossplay/core/test' because
they transitively import vitest, which only loads inside a test run.

User-facing here: by, defineConfig, App, errors.
Driver authors: the PlatformDriver contract types.
Tooling (CLI/viewer): trace reading.

## Constructors

### Constructor

> **new App**(`session`, `opts`): `App`

#### Parameters

##### session

[`DriverSession`](../interfaces/DriverSession.md)

##### opts

`AppOptions`

#### Returns

`App`

## Properties

### hadFailure

> **hadFailure**: `boolean` = `false`

True once any step failed — drives retain-on-failure (config.trace).

## Methods

### click()

> **click**(`selector`): `Promise`\<`void`\>

Alias of tap for web-minded readers.

#### Parameters

##### selector

[`UnifiedSelector`](../type-aliases/UnifiedSelector.md)

#### Returns

`Promise`\<`void`\>

***

### fill()

> **fill**(`selector`, `value`, `opts?`): `Promise`\<`void`\>

Fill a text field. The value is masked in the trace by default (NFR-017);
pass { mask: false } to opt out for non-sensitive fields.

#### Parameters

##### selector

[`UnifiedSelector`](../type-aliases/UnifiedSelector.md)

##### value

`string`

##### opts?

###### mask?

`boolean`

#### Returns

`Promise`\<`void`\>

***

### getText()

> **getText**(`selector`): `Promise`\<`string`\>

#### Parameters

##### selector

[`UnifiedSelector`](../type-aliases/UnifiedSelector.md)

#### Returns

`Promise`\<`string`\>

***

### goto()

> **goto**(`url`): `Promise`\<`void`\>

Navigate (web only in v0.1). Android tests express flows via interactions.

#### Parameters

##### url

`string`

#### Returns

`Promise`\<`void`\>

***

### native()

> **native**\<`T`\>(): `T`

Escape hatch (FR-003): raw platform object, caller-asserted type.

#### Type Parameters

##### T

`T`

#### Returns

`T`

***

### screenshot()

> **screenshot**(): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Capture a screenshot as its own trace step; returns the PNG bytes.

#### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

***

### tap()

> **tap**(`selector`): `Promise`\<`void`\>

Semantically unified: tap on Android, click on web (FR-001).

#### Parameters

##### selector

[`UnifiedSelector`](../type-aliases/UnifiedSelector.md)

#### Returns

`Promise`\<`void`\>

***

### waitFor()

> **waitFor**(`selector`): `Promise`\<`void`\>

Wait until the element is visible (FR-001); no action performed.

#### Parameters

##### selector

[`UnifiedSelector`](../type-aliases/UnifiedSelector.md)

#### Returns

`Promise`\<`void`\>
