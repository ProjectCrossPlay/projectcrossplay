/**
 * Spike B-003, part 2: prove a custom Vitest reporter gets per-test lifecycle
 * + results — the hook point where @crossplay/core's trace writer finalizes
 * trace files and the CLI prints the C3 output format.
 */
import { DefaultReporter } from 'vitest/reporters';

export default class SpikeTraceReporter extends DefaultReporter {
  onFinished(files = [], errors = []) {
    const results = [];
    for (const file of files) {
      for (const task of file.tasks ?? []) {
        results.push({
          test: task.name,
          state: task.result?.state ?? 'unknown',
          durationMs: Math.round(task.result?.duration ?? 0),
        });
      }
    }
    // The real reporter writes manifest.json here; the spike just proves access.
    console.log('SPIKE-REPORTER ' + JSON.stringify(results));
    super.onFinished(files, errors);
  }
}
