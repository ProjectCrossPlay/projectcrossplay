/**
 * In-memory PlatformDriver used by core's unit tests: a tiny "UI" whose
 * elements can appear late, animate, or duplicate — everything the auto-wait
 * engine and error model must handle, with no real platform attached.
 */
import type {
  DriverAction,
  DriverSession,
  ElementHandle,
  ElementState,
  UnifiedSelector,
} from '../src/driver.js';

export interface FakeElement {
  id: string;
  testId?: string;
  text?: string;
  role?: string;
  name?: string;
  visible: boolean;
  enabled: boolean;
  bounds: { x: number; y: number; width: number; height: number } | null;
  /** Set to make the element move on every poll (never stable). */
  animating?: boolean;
  value?: string;
}

export class FakeSession implements DriverSession {
  elements: FakeElement[] = [];
  actions: Array<{ el: string; action: DriverAction }> = [];
  disposed = 0;
  findCalls = 0;

  async findElements(selector: UnifiedSelector): Promise<ElementHandle[]> {
    this.findCalls++;
    return this.elements
      .filter((e) => {
        switch (selector.kind) {
          case 'testId':
            return e.testId === selector.value;
          case 'text':
            return selector.exact === false
              ? (e.text ?? '').includes(selector.value)
              : e.text === selector.value;
          case 'role':
            return e.role === selector.role && (selector.name === undefined || e.name === selector.name);
        }
      })
      .map((e) => ({ id: e.id }));
  }

  async getElementState(el: ElementHandle): Promise<ElementState> {
    const e = this.byId(el.id);
    if (!e) return { present: false, visible: false, enabled: false, bounds: null };
    if (e.animating && e.bounds) e.bounds = { ...e.bounds, x: e.bounds.x + 5 };
    return { present: true, visible: e.visible, enabled: e.enabled, bounds: e.bounds ? { ...e.bounds } : null };
  }

  async performAction(el: ElementHandle, action: DriverAction): Promise<void> {
    this.actions.push({ el: el.id, action });
    const e = this.byId(el.id);
    if (e && action.kind === 'fill') e.value = action.value;
  }

  async getText(el: ElementHandle): Promise<string> {
    return this.byId(el.id)?.text ?? '';
  }

  captureState(kind: 'screenshot'): Promise<Uint8Array>;
  captureState(kind: 'hierarchy'): Promise<string>;
  async captureState(kind: 'screenshot' | 'hierarchy'): Promise<Uint8Array | string> {
    return kind === 'screenshot' ? new Uint8Array([0x89, 0x50, 0x4e, 0x47]) : '<fake-hierarchy/>';
  }

  native<T>(): T {
    return this as unknown as T;
  }

  async dispose(): Promise<void> {
    this.disposed++;
  }

  private byId(id: string): FakeElement | undefined {
    return this.elements.find((e) => e.id === id);
  }
}

export function el(partial: Partial<FakeElement> & { id: string }): FakeElement {
  return {
    visible: true,
    enabled: true,
    bounds: { x: 0, y: 0, width: 100, height: 40 },
    ...partial,
  };
}
