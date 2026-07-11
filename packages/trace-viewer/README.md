# @projectcrossplay/trace-viewer

Self-contained Preact bundle that renders [CrossPlay](https://github.com/ProjectCrossPlay/projectcrossplay) trace files: a timeline, per-step screenshots, and failure hierarchy dumps.

This package is a dependency of [`@projectcrossplay/cli`](https://www.npmjs.com/package/@projectcrossplay/cli)'s `crossplay show-trace` command — you don't install or import it directly. It has no server-side trust boundary: trace files are treated as untrusted input and parsed identically whether served locally or dropped into the browser, and hierarchy dumps render as text-only, never `innerHTML`.

## License

Apache-2.0
