[**CrossPlay API reference**](../../README.md)

***

[CrossPlay API reference](../../README.md) / [index](../README.md) / DriverSession

# Interface: DriverSession

## Methods

### captureState()

#### Call Signature

> **captureState**(`kind`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Platform state capture for traces (FR-050/052).

##### Parameters

###### kind

`"screenshot"`

##### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

#### Call Signature

> **captureState**(`kind`): `Promise`\<`string`\>

##### Parameters

###### kind

`"hierarchy"`

##### Returns

`Promise`\<`string`\>

***

### dispose()

> **dispose**(): `Promise`\<`void`\>

Release everything: processes, connections, port-forwards. Idempotent.

#### Returns

`Promise`\<`void`\>

***

### findElements()

> **findElements**(`selector`): `Promise`\<[`ElementHandle`](ElementHandle.md)[]\>

Resolve a unified selector to zero or more element handles. Never waits.

#### Parameters

##### selector

[`UnifiedSelector`](../type-aliases/UnifiedSelector.md)

#### Returns

`Promise`\<[`ElementHandle`](ElementHandle.md)[]\>

***

### getElementState()

> **getElementState**(`el`): `Promise`\<[`ElementState`](ElementState.md)\>

Cheap state snapshot for one element. Called repeatedly (adaptive backoff)
by core's auto-wait loop, so implementations must avoid expensive work:
no screenshots, no hierarchy dumps, no reflows beyond what the platform
requires to answer.

#### Parameters

##### el

[`ElementHandle`](ElementHandle.md)

#### Returns

`Promise`\<[`ElementState`](ElementState.md)\>

***

### getText()

> **getText**(`el`): `Promise`\<`string`\>

Read an element's visible text. Separate from performAction because
actions return void by contract (fixed during B-020: the architecture
draft routed getText through performAction, which cannot return data).

#### Parameters

##### el

[`ElementHandle`](ElementHandle.md)

#### Returns

`Promise`\<`string`\>

***

### native()

> **native**\<`T`\>(): `T`

Escape hatch (FR-003): the raw platform object — Playwright Page for web,
AndroidBridge session for Android. Type parameter is caller-asserted.

#### Type Parameters

##### T

`T`

#### Returns

`T`

***

### navigate()?

> `optional` **navigate**(`url`): `Promise`\<`void`\>

Optional (additive within 0.x): navigate to a URL. Web drivers implement
this; app.goto() raises a clear platform error where it's absent.

#### Parameters

##### url

`string`

#### Returns

`Promise`\<`void`\>

***

### performAction()

> **performAction**(`el`, `action`): `Promise`\<`void`\>

Execute a primitive action on an element core has already deemed actionable.

#### Parameters

##### el

[`ElementHandle`](ElementHandle.md)

##### action

[`DriverAction`](../type-aliases/DriverAction.md)

#### Returns

`Promise`\<`void`\>
