# Spike B-004 Results — UIA2 bridge latency (2026-07-09)

Emulator: crossplay-api30 (API 30, arm64, Apple Silicon host) · server: appium-uiautomator2-server v10.3.2 · transport: HTTP over `adb forward tcp:6790`.

## Budget validation (FR-022: session startup ≤ 10s post-install)

| Measurement | Result | Notes |
|---|---|---|
| APK install (one-time, both) | 339 + 337 ms | excluded from budget by spec |
| Server ready (instrumentation start → /status 200) | 1,545 ms | adaptive poll 50→300ms |
| Session create (POST /session) | 22 ms | |
| **Total session startup** | **1,567 ms** | **✅ 6.4× inside the 10s budget** |

## Operation latencies (steady state)

| Operation | Latency |
|---|---|
| findElement (class name) | 98 ms |
| click | 97 ms |
| getText | 9 ms |
| state-query pair (rect + displayed) — the auto-wait poll cost | 299 ms |
| hierarchy dump (/source, 52 KB) | 244 ms |
| screenshot (165 KB) | 291 ms |

Auto-wait implication: one poll cycle ≈ 150 ms/query → core's 100–200 ms adaptive interval is well matched; bounds-stability detection (2–4 polls) costs ≈ 0.5–1s worst case. Consistent with the 0-flake strategy.

## Protocol findings (must be encoded in our TS AndroidBridge client)

1. **Find-element body is NOT W3C**: server expects `{strategy, selector, context}` — sending `{using, value}` returns `FindElementModel: mandatory field 'selector' is not present`. Response element key IS W3C (`element-6066-11e4-a52e-4f735466cecf`).
2. **Server base path**: `/wd/hub` prefix (v10.3.2).
3. **Session lifecycle**: `DELETE /session/:id` terminates the instrumentation process — the socket then drops. The bridge must treat the server as **one session per instrumentation run**: keep the session alive across tests within a run (matches the architecture's warm-server strategy) and restart instrumentation for a fresh session. Dispose = delete session *then* expect process exit, not the reverse.

## Verdict
ADR-002 (reuse appium-uiautomator2-server + custom TS client) **validated**. No fallback needed. Pin v10.3.2; vendor APKs per ADR follow-up.
