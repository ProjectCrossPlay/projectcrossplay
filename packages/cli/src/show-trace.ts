/**
 * crossplay show-trace — terminal summary of a .trace file. The full Preact
 * viewer (ADR-004, wireframes W1–W3) lands in Sprint 3; this keeps traces
 * inspectable from day one and exercises the strict reader (NFR-018).
 */
import { readTrace } from '@projectcrossplay/core';
import { dim, FAIL, OK, seconds } from './ui.js';

export async function showTrace(file: string): Promise<number> {
  let trace: Awaited<ReturnType<typeof readTrace>>;
  try {
    trace = await readTrace(file);
  } catch (e) {
    // W3 semantics: fail closed, say why, confirm nothing was executed.
    console.error(`${FAIL} Cannot read this trace`);
    console.error(`  ${e instanceof Error ? e.message : String(e)}`);
    console.error('  Traces are opened as untrusted data — no content from the file has been executed.');
    return 1;
  }

  const m = trace.manifest;
  console.log(`\nCrossPlay Trace  ${m.spec}  ${m.target}  ${m.result === 'failed' ? FAIL + ' FAILED' : OK + ' PASSED'}`);
  console.log(dim(`${m.startedAt} · ${trace.steps.length} steps · ${seconds(m.durationMs)}\n`));

  for (const s of trace.steps) {
    const symbol = s.status === 'failed' ? FAIL : OK;
    const label = [s.action, s.value, s.selector].filter(Boolean).join(' ');
    console.log(`  ${symbol} ${String(s.i + 1).padStart(2)} ${label.padEnd(60)} ${seconds(s.t1 - s.t0)}`);
    if (s.error) for (const line of s.error.split('\n')) console.log(`       ${line}`);
  }
  console.log(dim('\n(full visual viewer ships in v0.1: crossplay show-trace will open it in your browser)'));
  return 0;
}
