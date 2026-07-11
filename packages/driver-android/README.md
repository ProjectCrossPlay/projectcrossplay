# @projectcrossplay/driver-android

UIAutomator2-backed [`PlatformDriver`](https://github.com/ProjectCrossPlay/projectcrossplay/blob/main/docs/driver-plugin.md) for [CrossPlay](https://github.com/ProjectCrossPlay/projectcrossplay): native, React Native, and Kotlin/Java Android apps over ADB — **no Appium server required**.

## Install

```bash
npm install -D @projectcrossplay/core @projectcrossplay/driver-android
```

Requires the Android SDK platform tools (`adb`) on `PATH` and a connected device or running emulator.

## Usage

Register the driver for a target in `crossplay.config.ts`:

```ts
import { defineConfig } from '@projectcrossplay/core';

export default defineConfig({
  targets: {
    android: { platform: 'android', use: { apk: './app-debug.apk' } },
  },
});
```

`by.testId(...)` resolves to both Android resource-id and content-desc queries so the same spec runs unmodified against native Kotlin/Java and React Native apps. See the [selector guide](https://github.com/ProjectCrossPlay/projectcrossplay/blob/main/docs/selectors.md) for the full per-platform mapping.

## License

Apache-2.0
