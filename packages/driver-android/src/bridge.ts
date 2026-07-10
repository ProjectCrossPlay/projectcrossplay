/**
 * AndroidBridge (ADR-002): thin HTTP client for the on-device
 * appium-uiautomator2-server, over an adb port-forward (127.0.0.1 only,
 * NFR-016). Zero dependencies — global fetch.
 *
 * Protocol facts baked in from spike B-004 (src/spikes/uia2-bridge/RESULTS.md):
 * 1. Find bodies are NOT W3C: the server wants `{strategy, selector, context}`
 *    (we also send `using`/`value` aliases — the server ignores extras, and
 *    this tolerates version drift). Response element keys ARE W3C.
 * 2. Base path is `/wd/hub` (v10.3.2).
 * 3. `DELETE /session/:id` terminates the instrumentation process — one
 *    session per instrumentation run; dispose = delete then expect exit.
 */

const W3C_ELEMENT_KEY = 'element-6066-11e4-a52e-4f735466cecf';

export type UIA2Strategy = 'id' | 'accessibility id' | 'class name' | '-android uiautomator';

interface UIA2Response {
  sessionId?: string;
  value?: unknown;
}

interface UIA2ErrorValue {
  error?: string;
  message?: string;
}

export class BridgeError extends Error {
  constructor(
    readonly status: number,
    readonly uia2Error: string,
    message: string,
  ) {
    super(message);
    this.name = 'BridgeError';
  }

  get isStaleElement(): boolean {
    // W3C/JSONWP use 404 for several distinct error codes (stale element,
    // no such element, no such window, unknown command…) — the status alone
    // is ambiguous. Only the 'stale element reference' error code means
    // stale; treating every 404 as stale would mask real failures behind
    // "element just disappeared" (getElementState swallows this as absent).
    return this.uia2Error.includes('stale');
  }
}

export class AndroidBridge {
  private sessionId: string | null = null;

  constructor(
    private readonly baseUrl: string, // e.g. http://127.0.0.1:PORT/wd/hub
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async call(method: string, path: string, body?: unknown, timeoutMs = 20_000): Promise<unknown> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? null : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data = (await res.json().catch(() => ({}))) as UIA2Response;
    if (!res.ok || (data.value as UIA2ErrorValue | undefined)?.error) {
      const err = (data.value ?? {}) as UIA2ErrorValue;
      throw new BridgeError(res.status, err.error ?? '', err.message ?? `UIA2 ${method} ${path} → HTTP ${res.status}`);
    }
    return data;
  }

  private sessionPath(suffix = ''): string {
    if (!this.sessionId) throw new Error('bridge has no session (launch not completed?)');
    return `/session/${this.sessionId}${suffix}`;
  }

  /** Poll /status with adaptive backoff until the server answers (spike: ~1.5s). */
  async waitUntilReady(timeoutMs: number): Promise<void> {
    const start = Date.now();
    let delay = 50;
    for (;;) {
      try {
        const res = await this.fetchImpl(`${this.baseUrl}/status`, { signal: AbortSignal.timeout(1_000) });
        if (res.ok) return;
      } catch {
        // not up yet
      }
      if (Date.now() - start > timeoutMs) {
        throw new Error(`UIAutomator2 server did not become ready within ${Math.round(timeoutMs / 1000)}s`);
      }
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(Math.round(delay * 1.5), 300);
    }
  }

  async createSession(): Promise<string> {
    const data = (await this.call('POST', '/session', {
      capabilities: { firstMatch: [{}], alwaysMatch: {} },
    })) as { sessionId?: string; value?: { sessionId?: string } };
    const sid = data.value?.sessionId ?? data.sessionId;
    if (!sid) throw new Error('UIA2 session create returned no sessionId');
    this.sessionId = sid;
    return sid;
  }

  /** Spike finding #3: this kills the instrumentation process. Last call ever. */
  async deleteSession(): Promise<void> {
    if (!this.sessionId) return;
    const sid = this.sessionId;
    this.sessionId = null;
    try {
      await this.call('DELETE', `/session/${sid}`, undefined, 5_000);
    } catch {
      // the socket dropping mid-response is the expected shutdown mode
    }
  }

  async findElements(strategy: UIA2Strategy, selector: string): Promise<string[]> {
    const data = (await this.call('POST', this.sessionPath('/elements'), {
      strategy,
      selector,
      context: '',
      // aliases for server versions that read W3C names:
      using: strategy,
      value: selector,
    })) as { value?: Array<Record<string, string>> };
    return (data.value ?? []).map((el) => el[W3C_ELEMENT_KEY] ?? el['ELEMENT']!).filter(Boolean);
  }

  async elementRect(elementId: string): Promise<{ x: number; y: number; width: number; height: number }> {
    const data = (await this.call('GET', this.sessionPath(`/element/${elementId}/rect`))) as {
      value: { x: number; y: number; width: number; height: number };
    };
    return data.value;
  }

  async elementAttribute(elementId: string, name: string): Promise<string> {
    const data = (await this.call('GET', this.sessionPath(`/element/${elementId}/attribute/${name}`))) as {
      value: unknown;
    };
    return String(data.value);
  }

  async click(elementId: string): Promise<void> {
    await this.call('POST', this.sessionPath(`/element/${elementId}/click`), {});
  }

  async clear(elementId: string): Promise<void> {
    await this.call('POST', this.sessionPath(`/element/${elementId}/clear`), {});
  }

  async sendKeys(elementId: string, text: string): Promise<void> {
    await this.call('POST', this.sessionPath(`/element/${elementId}/value`), {
      text,
      value: [...text], // alias for older handler shapes
    });
  }

  async text(elementId: string): Promise<string> {
    const data = (await this.call('GET', this.sessionPath(`/element/${elementId}/text`))) as { value?: string };
    return data.value ?? '';
  }

  async screenshot(): Promise<Uint8Array> {
    const data = (await this.call('GET', this.sessionPath('/screenshot'))) as { value?: string };
    return Uint8Array.from(Buffer.from(data.value ?? '', 'base64'));
  }

  async source(): Promise<string> {
    const data = (await this.call('GET', this.sessionPath('/source'))) as { value?: string };
    return data.value ?? '';
  }
}
