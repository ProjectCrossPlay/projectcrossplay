/**
 * Unified selector factory (FR-030/031). `by.*` is the only way user code
 * constructs selectors; drivers receive the resulting discriminated union and
 * map it to platform semantics (data-testid / resource-id, ARIA role / widget
 * class). Ambiguity policy is core's, not the selector's (FR-032, wait.ts).
 */
import type { SemanticRole, UnifiedSelector } from './driver.js';

export const by = {
  testId(value: string): UnifiedSelector {
    return { kind: 'testId', value };
  },
  text(value: string, opts?: { exact?: boolean }): UnifiedSelector {
    return opts?.exact === undefined ? { kind: 'text', value } : { kind: 'text', value, exact: opts.exact };
  },
  role(role: SemanticRole, opts?: { name?: string }): UnifiedSelector {
    return opts?.name === undefined ? { kind: 'role', role } : { kind: 'role', role, name: opts.name };
  },
} as const;

/** Canonical printable form — used verbatim in errors, traces, and the viewer (C4). */
export function formatSelector(s: UnifiedSelector): string {
  switch (s.kind) {
    case 'testId':
      return `by.testId('${s.value}')`;
    case 'text':
      return s.exact === undefined ? `by.text('${s.value}')` : `by.text('${s.value}', { exact: ${s.exact} })`;
    case 'role':
      return s.name === undefined
        ? `by.role('${s.role}')`
        : `by.role('${s.role}', { name: '${s.name}' })`;
  }
}
