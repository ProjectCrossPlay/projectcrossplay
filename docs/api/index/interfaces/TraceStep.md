[**CrossPlay API reference**](../../README.md)

***

[CrossPlay API reference](../../README.md) / [index](../README.md) / TraceStep

# Interface: TraceStep

## Properties

### action

> **action**: `string`

***

### error?

> `optional` **error?**: `string`

***

### hierarchy?

> `optional` **hierarchy?**: `string`

***

### i

> **i**: `number`

***

### masked?

> `optional` **masked?**: `boolean`

***

### screenshot?

> `optional` **screenshot?**: `string`

***

### selector?

> `optional` **selector?**: `string`

***

### status

> **status**: `"passed"` \| `"failed"`

***

### t0

> **t0**: `number`

ms since run start

***

### t1

> **t1**: `number`

***

### value?

> `optional` **value?**: `string`

For fill steps: the loggable value — '•••••••' unless masking was opted out.

***

### waitLog?

> `optional` **waitLog?**: [`WaitLogEntry`](WaitLogEntry.md)[]
