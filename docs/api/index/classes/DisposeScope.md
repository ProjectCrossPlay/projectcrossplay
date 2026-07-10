[**CrossPlay API reference**](../../README.md)

***

[CrossPlay API reference](../../README.md) / [index](../README.md) / DisposeScope

# Class: DisposeScope

DisposeScope (NFR-014): every resource acquired during a test registers a
cleanup here; the scope unwinds LIFO on pass, fail, or crash. Cleanup errors
are collected, never masked, and never prevent later cleanups from running.

## Constructors

### Constructor

> **new DisposeScope**(): `DisposeScope`

#### Returns

`DisposeScope`

## Methods

### add()

> **add**(`fn`): `void`

#### Parameters

##### fn

() => `void` \| `Promise`\<`void`\>

#### Returns

`void`

***

### dispose()

> **dispose**(): `Promise`\<`void`\>

Idempotent. Runs all cleanups LIFO; throws an AggregateError only after all ran.

#### Returns

`Promise`\<`void`\>
