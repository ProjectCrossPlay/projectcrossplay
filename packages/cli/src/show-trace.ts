/**
 * crossplay show-trace (B-041, ADR-004, wireframes W1–W3): quick terminal
 * summary (useful headless/CI) plus the local Preact viewer, opened
 * automatically in a browser when running interactively.
 */
import { readTrace } from '@projectcrossplay/core';
import { dim, FAIL, OK, seconds } from './ui.js';
import { startViewerServer, tryOpenBrowser } from './viewer-server.js';

export interface ShowTraceOptions {
  /** Start the local viewer server and try to open it. Default: true when interactive. */
  open?: boolean;
}

export async function showTrace(file: string, opts: ShowTraceOptions = {}): Promise<number> {
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

  const shouldOpen = opts.open ?? process.stdout.isTTY === true;
  if (!shouldOpen) {
    console.log(dim('\n(non-interactive: viewer not started — run without --no-open, or in a terminal, to view visually)'));
    return 0;
  }

  const server = await startViewerServer(file);
  console.log(`\nViewer: ${server.url}`);
  const opened = await tryOpenBrowser(server.url);
  console.log(dim(opened ? 'Opened in your browser. Press Ctrl+C to stop.' : 'Open the URL above manually. Press Ctrl+C to stop.'));

  await new Promise<void>((resolve) => {
    process.on('SIGINT', () => resolve());
    process.on('SIGTERM', () => resolve());
  });
  await server.close();
  return 0;
}
