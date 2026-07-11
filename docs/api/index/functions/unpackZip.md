[**CrossPlay API reference**](../../README.md)

***

[CrossPlay API reference](../../README.md) / [index](../README.md) / unpackZip

# Function: unpackZip()

> **unpackZip**(`file`): [`ZipEntry`](../interfaces/ZipEntry.md)[]

Strict store-only reader. Throws on anything unexpected — corrupted or
hostile files must fail closed (W3 empty state), never be half-parsed.

## Parameters

### file

`Uint8Array`

## Returns

[`ZipEntry`](../interfaces/ZipEntry.md)[]
