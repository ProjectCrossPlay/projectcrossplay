/**
 * CrossPlay trace viewer (B-041, ADR-004, wireframes W1–W3). Preact,
 * self-contained: every trace — whether fetched from the local server or
 * dropped in by the user — is parsed with the exact same client-side code
 * path (parseTraceEntries from @projectcrossplay/core/browser), so there is
 * no server-side trust boundary to bypass (NFR-018).
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { parseTraceEntries, unpackZip, type ParsedTrace, type TraceStep } from '@projectcrossplay/core/browser';
import { HierarchyView } from './hierarchy.js';

type Tab = 'log' | 'hierarchy' | 'metadata';
const ROW_HEIGHT = 28;
const OVERSCAN = 6;

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

async function parseFile(bytes: ArrayBuffer): Promise<ParsedTrace> {
  return parseTraceEntries(unpackZip(new Uint8Array(bytes)));
}

export function App() {
  const [trace, setTrace] = useState<ParsedTrace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState(0);
  const [tab, setTab] = useState<Tab>('log');
  const [theme, setTheme] = useState<'dark' | 'light'>(
    (typeof localStorage !== 'undefined' && (localStorage.getItem('crossplay-theme') as 'dark' | 'light')) || 'dark',
  );
  const [showHelp, setShowHelp] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(400);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('crossplay-theme', theme);
  }, [theme]);

  // Initial load: the CLI server places the trace at ./trace.data alongside
  // this bundle (same-origin fetch, no CORS surface).
  useEffect(() => {
    fetch('trace.data')
      .then((r) => {
        if (!r.ok) throw new Error(`server returned HTTP ${r.status}`);
        return r.arrayBuffer();
      })
      .then(parseFile)
      .then((t) => {
        setTrace(t);
        const firstFailed = t.steps.findIndex((s) => s.status === 'failed');
        setSelected(t.manifest.result === 'failed' && firstFailed >= 0 ? firstFailed : 0);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const openFile = (file: File) => {
    file
      .arrayBuffer()
      .then(parseFile)
      .then((t) => {
        setTrace(t);
        setError(null);
        setSelected(0);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  };

  // Drag-and-drop "open another file" (W3) — window-level, active whenever a trace is loaded or not.
  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      setDragActive(true);
    };
    const onDragLeave = () => setDragActive(false);
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer?.files?.[0];
      if (file) openFile(file);
    };
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  const steps = trace?.steps ?? [];

  const firstFailedIndex = useMemo(() => steps.findIndex((s) => s.status === 'failed'), [steps]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === '?') setShowHelp((h) => !h);
      else if (e.key === 'Escape') setShowHelp(false);
      else if (e.key === 'f' || e.key === 'F') {
        if (firstFailedIndex >= 0) setSelected(firstFailedIndex);
      } else if (e.key === 'ArrowRight') setSelected((i) => Math.min(i + 1, steps.length - 1));
      else if (e.key === 'ArrowLeft') setSelected((i) => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [firstFailedIndex, steps.length]);

  useEffect(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const onResize = () => setViewportHeight(el.clientHeight);
    onResize();
    const ro = new ResizeObserver(onResize);
    ro.observe(el);
    return () => ro.disconnect();
  }, [trace]);

  // Blob URLs must be revoked or they leak for the tab's lifetime (NFR-014) —
  // each step change (or dropping in a new trace) creates one URL and
  // revokes exactly the previous one, never accumulating.
  useEffect(() => {
    const currentStep = trace?.steps[selected];
    if (!trace || !currentStep?.screenshot || !trace.assets.has(currentStep.screenshot)) {
      setScreenshotUrl(null);
      return;
    }
    const blob = new Blob([trace.assets.get(currentStep.screenshot)! as BlobPart], { type: 'image/png' });
    const url = URL.createObjectURL(blob);
    setScreenshotUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [trace, selected]);

  if (error) return <EmptyState error={error} onOpen={() => fileInputRef.current?.click()} inputRef={fileInputRef} onFile={openFile} />;
  if (!trace) return <div class="stage stage-empty mono">Loading trace…</div>;

  const step = steps[selected] as TraceStep | undefined;
  const failed = trace.manifest.result === 'failed';

  // Manual virtualization: traces can have thousands of steps (NFR-013) —
  // only render rows in view + a small overscan, not the whole list.
  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const visibleCount = Math.ceil(viewportHeight / ROW_HEIGHT) + OVERSCAN * 2;
  const end = Math.min(steps.length, start + visibleCount);

  return (
    <div class={`app${dragActive ? ' dropzone-active' : ''}`}>
      <header class="header">
        <div>
          <div class="header-title">
            <span>CrossPlay Trace</span>
            <span class="header-meta">{trace.manifest.spec}</span>
            <span class="header-meta mono">{trace.manifest.target}</span>
            <span class={`badge ${failed ? 'fail' : 'pass'}`}>{failed ? '✖ FAILED' : '✔ PASSED'}</span>
          </div>
          <div class="header-meta mono">
            {new Date(trace.manifest.startedAt).toLocaleString()} · {steps.length} steps ·{' '}
            {seconds(trace.manifest.durationMs)}
          </div>
        </div>
        <div class="header-actions">
          <button onClick={() => fileInputRef.current?.click()}>Open file</button>
          <button onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}>
            {theme === 'dark' ? '☾' : '☀'}
          </button>
          <button onClick={() => setShowHelp(true)}>? keys</button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".trace"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (file) openFile(file);
            }}
          />
        </div>
      </header>

      <div class="body">
        <div class="steps-pane">
          <div
            class="steps-scroll"
            ref={scrollRef}
            onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
          >
            <div style={{ height: steps.length * ROW_HEIGHT, position: 'relative' }}>
              {steps.slice(start, end).map((s, i) => {
                const idx = start + i;
                return (
                  <div
                    key={idx}
                    class={`step-row mono${idx === selected ? ' selected' : ''}${s.status === 'failed' ? ' failed' : ''}`}
                    style={{ position: 'absolute', top: idx * ROW_HEIGHT, height: ROW_HEIGHT, width: '100%' }}
                    onClick={() => setSelected(idx)}
                  >
                    <span class={`step-glyph ${s.status === 'failed' ? 'fail' : 'pass'}`}>
                      {s.status === 'failed' ? '✖' : '✔'}
                    </span>
                    <span class="step-index">{idx + 1}</span>
                    <span class="step-action">{s.action}</span>
                    <span class="step-duration">{seconds(s.t1 - s.t0)}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div class="steps-footer">
            <kbd>F</kbd> first failure · <kbd>←</kbd>
            <kbd>→</kbd> prev/next
          </div>
        </div>

        <div class="main-pane">
          <div class="stage">
            {screenshotUrl ? (
              <img alt={`step ${selected + 1} screenshot`} src={screenshotUrl} />
            ) : (
              <div class="stage-empty">no screenshot for this step</div>
            )}
          </div>

          {step && (
            <div class="step-detail mono">
              <span>
                {[step.action, step.value, step.selector].filter(Boolean).join('  ')}
              </span>
              <span>{seconds(step.t1 - step.t0)}</span>
              <span class={step.status === 'failed' ? 'step-glyph fail' : 'step-glyph pass'}>
                {step.status === 'failed' ? '✖' : '✔'}
              </span>
            </div>
          )}

          {step?.error && <div class="error-banner mono">{step.error}</div>}

          <div class="tabs">
            {(['log', 'hierarchy', 'metadata'] as Tab[]).map((t) => (
              <div key={t} class={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
                {t === 'log' ? 'ACTION LOG' : t.toUpperCase()}
              </div>
            ))}
          </div>
          <div class="tab-content">
            {tab === 'log' && (
              <div class="mono">
                {(step?.waitLog ?? []).length === 0 && <div class="header-meta">no wait log for this step</div>}
                {(step?.waitLog ?? []).map((entry, i) => (
                  <div key={i} class={`log-line ${entry.ok ? 'ok' : 'fail'}`}>
                    <span class="t">+{entry.t}ms</span>
                    <span>
                      waiting: {entry.condition} {entry.ok ? '✔' : '✖'}
                      {entry.detail ? ` — ${entry.detail}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {tab === 'hierarchy' &&
              (step?.hierarchy && trace.assets.has(step.hierarchy) ? (
                <HierarchyView xml={new TextDecoder().decode(trace.assets.get(step.hierarchy)!)} />
              ) : (
                <div class="header-meta mono">no hierarchy captured for this step (only captured on failure)</div>
              ))}
            {tab === 'metadata' && (
              <div class="mono">
                <div class="meta-row">
                  <span class="k">formatVersion</span>
                  <span>1</span>
                </div>
                <div class="meta-row">
                  <span class="k">platform</span>
                  <span>{trace.manifest.platform}</span>
                </div>
                <div class="meta-row">
                  <span class="k">target</span>
                  <span>{trace.manifest.target}</span>
                </div>
                <div class="meta-row">
                  <span class="k">step index</span>
                  <span>{selected + 1}</span>
                </div>
                <div class="meta-row">
                  <span class="k">step masked</span>
                  <span>{String(step?.masked ?? false)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showHelp && (
        <div class="help-overlay" onClick={() => setShowHelp(false)}>
          <div class="help-card mono" onClick={(e) => e.stopPropagation()}>
            <strong>Keyboard shortcuts</strong>
            <dl>
              <dt>F</dt>
              <dd>Jump to first failed step</dd>
              <dt>← →</dt>
              <dd>Previous / next step</dd>
              <dt>?</dt>
              <dd>Toggle this help</dd>
              <dt>Esc</dt>
              <dd>Close this help</dd>
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({
  error,
  onOpen,
  inputRef,
  onFile,
}: {
  error: string;
  onOpen: () => void;
  inputRef: { current: HTMLInputElement | null };
  onFile: (f: File) => void;
}) {
  return (
    <div class="stage">
      <div class="empty-state">
        <h2>Cannot read this trace</h2>
        <p>
          The file is not a CrossPlay trace or is corrupted. (v1 traces only.)
          <br />
          Traces are opened as untrusted data — no content from the file has been executed.
        </p>
        <p class="mono">{error}</p>
        <button onClick={onOpen}>Open another file</button>
        <input
          ref={inputRef as { current: HTMLInputElement | null }}
          type="file"
          accept=".trace"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) onFile(file);
          }}
        />
      </div>
    </div>
  );
}
