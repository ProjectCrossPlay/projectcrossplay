# Spike A results — WebDriverAgent baseline (B-200, ADR-005 input)

**Date**: 2026-07-11 · **Host**: macOS (Darwin 23.5), Xcode 16.2, iPhone 16 simulator, iOS 18.3 runtime (xctestrun labeled 18.2)
**Setup**: WDA 15.1.4 vendored via `npm install appium-webdriveragent@15.1.4` (gitignored `node_modules/` — same pattern as `../uia2-bridge`); one-time `xcodebuild build-for-testing` ≈ 4–5 min; runner app installed once per simulator (parallel to Android's one-time server-APK install, FR-022).

## Headline numbers (tuned, steady-state — `spike-a-tuned.mjs`)

| Measure | iOS (WDA) | Android (UIA2, B-004) | Budget |
|---|---|---|---|
| Server ready (preinstalled runner via `simctl launch`) | 4.1s | — | — |
| Session create (`shouldWaitForQuiescence: false`) | 3.1s | — | — |
| **Total session startup** | **7.2s** | **1.57s** | **≤ 10s (NFR-203) ✔** |
| Tap | 1.0s | 97ms | within 30s action budget |
| Find + read (after nav, incl. settle-poll) | 1.9s | ~300ms | ″ |
| Fill leg (back-nav + find + tap + type + read-back, verified "Wi") | 9.7s total | — | ″ |
| Hierarchy dump | 2.6s / 21KB | — | trace-viewer compatible |
| Screenshot | 1.6s / ~677KB PNG | — | ″ |

## Tuning ladder (why each knob matters — measured, not assumed)

| Configuration | Server ready | Session | Total |
|---|---|---|---|
| Untuned: `xcodebuild test-without-building`, quiescence on, cold first launch | 51.2s | 7.9s | 59.1s |
| Same, warm | 16.5s | 7.0s | 23.5s |
| Preinstalled runner via `simctl launch` + `shouldWaitForQuiescence: false` | 6.8–7.8s | 3.6–4.3s | ~11s |
| + `waitForIdleTimeout: 0`, `animationCoolOffTimeout: 0` via `/appium/settings` | **4.1s** | **3.1s** | **7.2s** |

The last knob is legitimate, not a cheat: CrossPlay core owns ALL waiting (driver contract rule #1), so WDA's server-side idle/animation waits duplicate core's auto-wait loop. Disabling them is the architecturally correct configuration for this driver, and it's also what makes per-action latency acceptable.

## Protocol findings (the "is the bridge buildable" question — YES)

1. **A zero-dependency TS client over `fetch` drives everything** — session lifecycle, find (`predicate string` / `class name`), click, `value` (typing), text read, `/source` hierarchy, `/screenshot`, DELETE session. No Appium client library, no WebDriver npm package. Same shape as `AndroidBridge`.
2. **No port-forward layer needed at all** — the simulator shares the host network namespace, so WDA on `:8100` is directly reachable from localhost. One whole subsystem Android needs (`adb forward` management) that iOS-on-simulator doesn't. (Real devices will need `devicectl` tunneling or similar — out of v0.2 scope.)
3. **iOS 18 mixes element types across screens** — Settings' root renders rows as `XCUIElementTypeButton` (SwiftUI), the General screen as `XCUIElementTypeCell` (UIKit). Probed empirically (`probe.mjs`/`probe2.mjs`), not assumed. Directly validates FR-213's one-selector→N-native-queries design: role mappings must query compound type sets (e.g. listitem → Cell OR Button), exactly like Android's dual resource-id/content-desc expansion.
4. **First find on a fresh session costs ~4–5s** (accessibility snapshot warm-up); subsequent finds run 1–2s. Auto-wait's poll loop absorbs this naturally, but per-poll cost matters: WDA per-command latency is ~10× Android's. Fine within the 30s action budget; the main thing Spike A′ should try to beat.
5. **Sessions survive; teardown is clean** — DELETE `/session` doesn't kill the runner (unlike Android, where session-delete kills the instrumentation — spike finding #3 there). The runner app stays resident and reusable across sessions: good for suite-level reuse, and `simctl terminate` is the definitive cleanup.
6. **Operational gotcha**: simulators shut themselves down when idle/pressured — one run failed with "WDA never became ready" purely because the sim had quietly shut down between runs. The driver's `doctor`/launch path must check+boot rather than assume a booted device (Android's device-pick logic has the same shape).

## Verdict for ADR-005

Option A (WDA) is **viable and proven**: budget met, all protocol legs work, integration effort is low (the bridge client shape already exists twice in this codebase). Open question for Spike A′ (B-201): can a minimal custom XCTest server (Maestro-shaped) meaningfully beat 7.2s startup / ~1–2s per action, and at what Swift maintenance cost? A′ has a hard timebox; if it doesn't clearly win, A ships.
