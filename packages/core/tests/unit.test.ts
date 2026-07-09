import { describe, expect, test } from 'vitest';
import { resolveTarget } from '../src/config.js';
import { DisposeScope } from '../src/dispose.js';
import { CrossPlayError } from '../src/errors.js';
import { loadDriver } from '../src/registry.js';
import { by, formatSelector } from '../src/selector.js';
import { crc32, packZip, unpackZip } from '../src/zip.js';

describe('selector factory (B-022)', () => {
  test('canonical printable forms (C4: selectors shown verbatim)', () => {
    expect(formatSelector(by.testId('login-button'))).toBe("by.testId('login-button')");
    expect(formatSelector(by.text('Sign in'))).toBe("by.text('Sign in')");
    expect(formatSelector(by.text('Sign', { exact: false }))).toBe("by.text('Sign', { exact: false })");
    expect(formatSelector(by.role('button'))).toBe("by.role('button')");
    expect(formatSelector(by.role('button', { name: 'Sign in' }))).toBe(
      "by.role('button', { name: 'Sign in' })",
    );
  });
});

describe('DisposeScope (NFR-014)', () => {
  test('unwinds LIFO, is idempotent, and never skips a cleanup', async () => {
    const order: string[] = [];
    const scope = new DisposeScope();
    scope.add(() => void order.push('first'));
    scope.add(() => {
      order.push('second');
      throw new Error('cleanup failed');
    });
    scope.add(() => void order.push('third'));

    await expect(scope.dispose()).rejects.toThrow(AggregateError);
    expect(order).toEqual(['third', 'second', 'first']); // LIFO, error did not stop the rest
    await scope.dispose(); // idempotent — second call is a no-op
  });
});

describe('store-only zip (ADR-003 container)', () => {
  test('pack → unpack roundtrip with crc verification', () => {
    const entries = [
      { name: 'manifest.json', data: new TextEncoder().encode('{"formatVersion":1}') },
      { name: 'screenshots/0.png', data: new Uint8Array([1, 2, 3, 255, 0, 128]) },
      { name: 'empty.txt', data: new Uint8Array(0) },
    ];
    const unpacked = unpackZip(packZip(entries));
    expect(unpacked.map((e) => e.name)).toEqual(entries.map((e) => e.name));
    expect([...unpacked[1]!.data]).toEqual([1, 2, 3, 255, 0, 128]);
  });

  test('fails closed on corruption (NFR-018)', () => {
    const zip = packZip([{ name: 'a.txt', data: new TextEncoder().encode('hello') }]);
    zip[40] = zip[40]! ^ 0xff; // flip a byte inside the entry data region
    expect(() => unpackZip(zip)).toThrow();
    expect(() => unpackZip(new TextEncoder().encode('not a zip at all'))).toThrow(/not a zip/);
  });

  test('crc32 reference value', () => {
    // Known vector: crc32("123456789") = 0xCBF43926
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
});

describe('config + registry (B-021)', () => {
  const config = {
    targets: {
      web: { platform: 'web', use: { baseURL: 'http://localhost:4173' } },
      phone: { platform: 'android', use: { apk: './app.apk' } },
    },
  };

  test('resolveTarget builds the driver-facing TargetConfig', () => {
    expect(resolveTarget(config, 'web')).toEqual({
      name: 'web',
      platform: 'web',
      use: { baseURL: 'http://localhost:4173' },
    });
  });

  test('unknown target: 3-part error lists configured names', () => {
    const err = (() => {
      try {
        resolveTarget(config, 'ios');
      } catch (e) {
        return e as CrossPlayError;
      }
      return null;
    })();
    expect(err).toBeInstanceOf(CrossPlayError);
    expect(err!.message).toContain("unknown target 'ios'");
    expect(err!.message).toContain('web, phone');
    expect(err!.message).toContain('→');
  });

  test('unknown platform: names the driver config key (B-021)', async () => {
    const err = await loadDriver({ name: 'tv', platform: 'tvos', use: { baseURL: 'x' } }).catch((e) => e);
    expect(err).toBeInstanceOf(CrossPlayError);
    expect(err.message).toContain("no driver known for platform 'tvos'");
    expect(err.message).toContain('driver');
  });

  test('missing driver package: actionable install hint', async () => {
    const err = await loadDriver({
      name: 'x',
      platform: 'web',
      driver: '@projectcrossplay/driver-does-not-exist',
      use: { baseURL: 'x' },
    }).catch((e) => e);
    expect(err).toBeInstanceOf(CrossPlayError);
    expect(err.message).toContain('is not installed');
    expect(err.message).toContain('pnpm add -D @projectcrossplay/driver-does-not-exist');
  });
});
