/**
 * CrossPlay error model — every user-facing error follows the 3-part contract
 * from the approved design system: WHAT failed, WHY (evidence), and WHAT NEXT
 * (actionable fix). Wording lives here and only here so web and Android fail
 * identically (architecture §3.1).
 */
import type { UnifiedSelector } from './driver.js';
import { formatSelector } from './selector.js';

export interface ErrorParts {
  /** One line: what failed. Becomes the first message line. */
  what: string;
  /** Evidence lines, e.g. selector, wait summary, candidates. */
  why?: string[];
  /** Actionable next step(s). */
  next?: string[];
}

export class CrossPlayError extends Error {
  readonly parts: ErrorParts;

  constructor(parts: ErrorParts) {
    const lines = [parts.what];
    for (const w of parts.why ?? []) lines.push(`  ${w}`);
    for (const n of parts.next ?? []) lines.push(`  → ${n}`);
    super(lines.join('\n'));
    this.name = 'CrossPlayError';
    this.parts = parts;
  }
}

/** One auto-wait poll observation, kept for traces and error evidence (FR-042). */
export interface WaitLogEntry {
  /** ms since the action started */
  t: number;
  condition: 'present' | 'visible' | 'stable' | 'enabled';
  ok: boolean;
  detail?: string;
}

/** FR-042: timeout errors name the failed condition. */
export class TimeoutError extends CrossPlayError {
  readonly condition: WaitLogEntry['condition'];
  readonly waitLog: ReadonlyArray<WaitLogEntry>;

  constructor(opts: {
    selector: UnifiedSelector;
    timeoutMs: number;
    condition: WaitLogEntry['condition'];
    conditionDetail: string;
    waitLog: WaitLogEntry[];
  }) {
    const passed = (['present', 'visible', 'stable', 'enabled'] as const)
      .filter((c) => c !== opts.condition && opts.waitLog.some((e) => e.condition === c && e.ok))
      .map((c) => `${c} ✔`);
    super({
      what: `element ${opts.conditionDetail} after ${Math.round(opts.timeoutMs / 1000)}s`,
      why: [
        `selector: ${formatSelector(opts.selector)}`,
        `waited:   ${[...passed, `${opts.condition} ✖`].join('  ')}`,
      ],
      next: ['inspect the trace for per-poll detail: crossplay show-trace <trace>'],
    });
    this.name = 'TimeoutError';
    this.condition = opts.condition;
    this.waitLog = opts.waitLog;
  }
}

/** FR-032: multiple matches throw a clear error listing candidates. */
export class AmbiguityError extends CrossPlayError {
  constructor(opts: { selector: UnifiedSelector; candidates: string[] }) {
    super({
      what: `selector matched ${opts.candidates.length} elements, expected exactly 1`,
      why: [
        `selector: ${formatSelector(opts.selector)}`,
        ...opts.candidates.slice(0, 10).map((c, i) => `[${i + 1}] ${c}`),
        ...(opts.candidates.length > 10 ? [`… and ${opts.candidates.length - 10} more`] : []),
      ],
      next: ['narrow the selector (add a testId, or use by.role with a name)'],
    });
    this.name = 'AmbiguityError';
  }
}
