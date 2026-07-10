[**CrossPlay API reference**](../../README.md)

***

[CrossPlay API reference](../../README.md) / [index](../README.md) / PlatformDriver

# Interface: PlatformDriver

The CrossPlay driver contract (architecture doc §3.2, ADR-002).

This interface is the extension boundary of the whole framework: platform
drivers (`@projectcrossplay/driver-web`, `@projectcrossplay/driver-android`, future iOS or
community drivers) implement it, and core owns everything platform-neutral
on top of it — selector resolution policy, the auto-wait loop, tracing, and
error wording.

Contract rules (violating these breaks cross-platform parity):
1. Drivers never wait. `findElements` and `getElementState` return the
   current state immediately; core's auto-wait engine decides when to retry.
2. Drivers never throw ambiguity errors. `findElements` returns all matches;
   core raises the candidate-listing error (FR-032).
3. Widening this interface is semver-relevant. Within 0.x, only additive
   optional members are allowed. Platform-specific capability goes through
   `native<T>()`, not new required methods.

## Properties

### platform

> `readonly` **platform**: `string`

Stable platform identifier: 'web' | 'android' | future 'ios', 'flutter'…

## Methods

### launch()

> **launch**(`target`, `ctx`): `Promise`\<[`DriverSession`](DriverSession.md)\>

#### Parameters

##### target

[`TargetConfig`](TargetConfig.md)

##### ctx

[`LaunchContext`](LaunchContext.md)

#### Returns

`Promise`\<[`DriverSession`](DriverSession.md)\>
