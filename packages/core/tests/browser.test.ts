import { describe, expect, test } from 'vitest';
import { packZip, parseTraceEntries, TRACE_FORMAT_VERSION, unpackZip } from '../src/browser.js';

describe('browser-safe trace parsing (B-041: viewer parses client-side)', () => {
  test('parseTraceEntries + zip roundtrip works with zero Node builtins', () => {
    const manifest = {
      formatVersion: TRACE_FORMAT_VERSION,
      spec: 'demo.spec.ts › example',
      target: 'chromium',
      platform: 'web',
      result: 'passed' as const,
      startedAt: new Date(0).toISOString(),
      durationMs: 1234,
    };
    const steps = [{ i: 0, action: 'tap', selector: "by.testId('go')", status: 'passed' as const, t0: 0, t1: 100 }];
    const zip = packZip([
      { name: 'manifest.json', data: new TextEncoder().encode(JSON.stringify(manifest)) },
      { name: 'steps.jsonl', data: new TextEncoder().encode(steps.map((s) => JSON.stringify(s)).join('\n') + '\n') },
      { name: 'screenshots/0.png', data: new Uint8Array([1, 2, 3]) },
    ]);

    const parsed = parseTraceEntries(unpackZip(zip));
    expect(parsed.manifest).toEqual(manifest);
    expect(parsed.steps).toEqual(steps);
    expect(parsed.assets.get('screenshots/0.png')).toEqual(new Uint8Array([1, 2, 3]));
  });

  test('rejects a corrupt/foreign file (W3: fail closed)', () => {
    expect(() => parseTraceEntries(unpackZip(new TextEncoder().encode('not a zip')))).toThrow();
  });
});
