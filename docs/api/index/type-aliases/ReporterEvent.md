[**CrossPlay API reference**](../../README.md)

***

[CrossPlay API reference](../../README.md) / [index](../README.md) / ReporterEvent

# Type Alias: ReporterEvent

> **ReporterEvent** = \{ `kind`: `"testStart"`; `platform`: `string`; `spec`: `string`; `target`: `string`; \} \| \{ `action`: `string`; `durationMs`: `number`; `kind`: `"step"`; `selector?`: `string`; `spec`: `string`; `status`: `"passed"` \| `"failed"`; \} \| \{ `durationMs`: `number`; `kind`: `"testEnd"`; `result`: `"passed"` \| `"failed"`; `spec`: `string`; `trace?`: `string`; \}

Reporter seam (FR-071). No telemetry ships in v0.1, but every run event
flows through this dispatcher, so adding an opt-in telemetry reporter later
touches no core logic — it's one more entry in `config.reporters`.

Reporters are fire-and-forget observers: a throwing reporter is disabled
for the rest of the run and never fails a test.
