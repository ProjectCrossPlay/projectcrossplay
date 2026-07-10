[**CrossPlay API reference**](../../README.md)

***

[CrossPlay API reference](../../README.md) / [index](../README.md) / LaunchContext

# Interface: LaunchContext

Facilities core hands to a driver at launch.

## Properties

### timeout

> **timeout**: `number`

Global action timeout in ms (default 30_000, FR-042).

## Methods

### log()

> **log**(`message`): `void`

Structured driver diagnostics routed into the trace, never stdout.

#### Parameters

##### message

`string`

#### Returns

`void`

***

### onDispose()

> **onDispose**(`fn`): `void`

Register cleanup that must run even if the test crashes (NFR-014).

#### Parameters

##### fn

() => `Promise`\<`void`\>

#### Returns

`void`
