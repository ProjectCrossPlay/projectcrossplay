[**CrossPlay API reference**](../../README.md)

***

[CrossPlay API reference](../../README.md) / [index](../README.md) / CrossPlayConfig

# Interface: CrossPlayConfig

## Properties

### reporters?

> `optional` **reporters?**: [`CrossPlayReporter`](CrossPlayReporter.md)[]

Reporter seam (FR-071). Empty in v0.1.

***

### targets

> **targets**: `Record`\<`string`, [`TargetDef`](TargetDef.md)\>

***

### timeout?

> `optional` **timeout?**: `number`

Global action timeout in ms (FR-042). Default 30_000.

***

### trace?

> `optional` **trace?**: `"on"` \| `"retain-on-failure"`

'on' (default): trace every run (FR-050). 'retain-on-failure': keep failures only.

***

### traceDir?

> `optional` **traceDir?**: `string`

Where .trace files land. Default '.crossplay/traces'.
