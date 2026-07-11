import { join, sep } from 'node:path';
import { describe, expect, test } from 'vitest';
import { resolveWithinWorkspace } from '../src/workspace-guard.js';

describe('resolveWithinWorkspace (B-105-04)', () => {
  const root = join(sep, 'workspace', 'project');

  test('resolves a plain relative path inside the root', () => {
    expect(resolveWithinWorkspace('tests/example.spec.ts', root)).toBe(join(root, 'tests', 'example.spec.ts'));
  });

  test('the root itself is allowed', () => {
    expect(resolveWithinWorkspace('.', root)).toBe(root);
  });

  test('rejects ../ traversal out of the root', () => {
    expect(() => resolveWithinWorkspace('../../etc/passwd', root)).toThrow(/escapes the workspace root/);
  });

  test('rejects an absolute path pointing elsewhere', () => {
    expect(() => resolveWithinWorkspace(join(sep, 'etc', 'passwd'), root)).toThrow(/escapes the workspace root/);
  });

  test('rejects a sibling directory that merely shares a string prefix with the root', () => {
    // The exact bug class fixed twice elsewhere in this repo: a naive
    // `resolved.startsWith(root)` check would wrongly allow this, since
    // "/workspace/project-evil" starts with "/workspace/project" as a
    // string. relative()+'..' doesn't have that failure mode.
    expect(() => resolveWithinWorkspace(join('..', 'project-evil', 'x'), root)).toThrow(/escapes the workspace root/);
  });

  test('defaults root to process.cwd() when omitted', () => {
    expect(resolveWithinWorkspace('foo.trace')).toBe(join(process.cwd(), 'foo.trace'));
  });
});
