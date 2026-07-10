[**CrossPlay API reference**](../../README.md)

***

[CrossPlay API reference](../../README.md) / [index](../README.md) / AndroidTargetOptions

# Interface: AndroidTargetOptions

## Properties

### activity?

> `optional` **activity?**: `string`

Fully qualified activity to launch. Default: the package's launcher activity.

***

### apk?

> `optional` **apk?**: `string`

Path to the app APK. Optional when the app is already installed and appId is set.

***

### appId?

> `optional` **appId?**: `string`

Application id (package name). Derived from the APK via aapt when omitted.

***

### device?

> `optional` **device?**: `string`

ADB serial; omit = single connected device (FR-021).
