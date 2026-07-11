#!/usr/bin/env node
/** @projectcrossplay/cli (B-024, FR-060–062) — init | doctor | test | show-trace. */
import { createRequire } from 'node:module';
import { Command } from 'commander';
import { doctor } from './doctor.js';
import { init } from './init.js';
import { showTrace } from './show-trace.js';
import { testCmd } from './test-cmd.js';

// Read from package.json rather than a hardcoded literal, so `--version`
// can't silently drift from the actual published version.
const { version } = createRequire(import.meta.url)('../package.json') as { version: string };

const program = new Command();

program.name('crossplay').description('One test API for web and native mobile').version(version);

program
  .command('init')
  .description('scaffold crossplay.config.ts and an example spec')
  .option('--ci', 'also scaffold a GitHub Actions workflow')
  .action(async (opts: { ci?: boolean }) => {
    process.exitCode = await init(opts);
  });

program
  .command('doctor')
  .description('check your environment; exit code = blocking problems')
  .option('--json', 'machine-readable output')
  .action(async (opts: { json?: boolean }) => {
    process.exitCode = await doctor(opts);
  });

program
  .command('test')
  .description('run the spec suite; exit code = failed tests')
  .option('--target <name>', "target name, comma-separated names, or 'all'")
  .option('--config <path>', 'path to crossplay.config.ts')
  .option('--json', 'machine-readable output')
  .action(async (opts: { target?: string; config?: string; json?: boolean }) => {
    process.exitCode = await testCmd(opts);
  });

program
  .command('show-trace')
  .description('summarize a .trace file and open the local viewer')
  .argument('<file>', 'path to a .trace file')
  .option('--no-open', 'print the summary only; do not start the viewer server')
  .action(async (file: string, opts: { open: boolean }, command: Command) => {
    // Commander defaults a --no-x flag's value to true when absent, which
    // would defeat showTrace's TTY auto-detection default — only pass a
    // value when the user actually typed --no-open.
    const explicit = command.getOptionValueSource('open') === 'cli';
    process.exitCode = await showTrace(file, explicit ? { open: opts.open } : {});
  });

await program.parseAsync(process.argv);
