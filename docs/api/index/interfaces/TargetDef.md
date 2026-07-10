[**CrossPlay API reference**](../../README.md)

***

[CrossPlay API reference](../../README.md) / [index](../README.md) / TargetDef

# Interface: TargetDef

## Properties

### driver?

> `optional` **driver?**: `string`

Driver package to load (B-021). Defaults by platform:
web → @projectcrossplay/driver-web, android → @projectcrossplay/driver-android.
Community drivers set this explicitly.

***

### platform

> **platform**: `string`

'web' | 'android' | any platform a driver package provides.

***

### use

> **use**: `Record`\<`string`, `unknown`\>

Platform options, passed to the driver verbatim (baseURL/browser, apk/device…).
