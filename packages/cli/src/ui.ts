/**
 * CLI output conventions (C4): ✔ green · ✖ red · ⚠ yellow · ↷ dim — symbols
 * carry the meaning even without color (CI logs, no-color terminals).
 * No color-library dependency: four ANSI codes, disabled when not a TTY or
 * NO_COLOR is set.
 */
const useColor = process.stdout.isTTY === true && process.env['NO_COLOR'] === undefined;

const paint = (code: number) => (s: string) => (useColor ? `[${code}m${s}[0m` : s);
export const green = paint(32);
export const red = paint(31);
export const yellow = paint(33);
export const dim = paint(2);

export const OK = green('✔');
export const FAIL = red('✖');
export const WARN = yellow('⚠');
export const SKIP = dim('↷');

export function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}
