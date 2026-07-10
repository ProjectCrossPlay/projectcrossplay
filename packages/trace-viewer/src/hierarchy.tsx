/**
 * Hierarchy tree (W2): renders a DOM/UI-XML dump as a collapsible, searchable
 * tree. Parsed via the browser's native DOMParser (no third-party XML/HTML
 * parser — smaller supply-chain surface, NFR-015) and rendered as Preact
 * elements with text nodes only, never innerHTML (NFR-018: hierarchy content
 * is untrusted).
 */
import { useMemo, useState } from 'preact/hooks';

interface TreeNodeProps {
  el: Element;
  query: string;
  depth: number;
}

const KEY_ATTRS = ['resource-id', 'content-desc', 'text', 'class', 'id', 'data-testid', 'name', 'role'];

function nodeMatches(el: Element, query: string): boolean {
  if (!query) return false;
  const q = query.toLowerCase();
  if (el.tagName.toLowerCase().includes(q)) return true;
  for (const attr of el.attributes) {
    if (attr.value.toLowerCase().includes(q)) return true;
  }
  return false;
}

function TreeNode({ el, query, depth }: TreeNodeProps) {
  const children = Array.from(el.children);
  const selfMatches = nodeMatches(el, query);
  const [open, setOpen] = useState(depth < 2 || selfMatches);

  const attrs = KEY_ATTRS.map((name) => (el.getAttribute(name) !== null ? [name, el.getAttribute(name)!] : null)).filter(
    (x): x is [string, string] => x !== null,
  );

  return (
    <div class="tree-node">
      <div class={selfMatches ? 'tree-match' : undefined}>
        {children.length > 0 ? (
          <span class="tree-toggle" onClick={() => setOpen((o) => !o)} role="button" tabIndex={0}>
            {open ? '▾' : '▸'}
          </span>
        ) : (
          <span class="tree-toggle">·</span>
        )}{' '}
        <span class="tree-tag">{el.tagName}</span>
        {attrs.map(([name, value]) => (
          <span key={name} class="tree-attr">
            {' '}
            {name}={JSON.stringify(value)}
          </span>
        ))}
      </div>
      {open && children.map((child, i) => <TreeNode key={i} el={child} query={query} depth={depth + 1} />)}
    </div>
  );
}

export function HierarchyView({ xml }: { xml: string }) {
  const [query, setQuery] = useState('');
  const root = useMemo(() => {
    try {
      // Android UI dumps are XML; web DOM snapshots are HTML — try XML first
      // (stricter), fall back to HTML. Both are parsed, never executed.
      const xmlDoc = new DOMParser().parseFromString(xml, 'application/xml');
      if (xmlDoc.querySelector('parsererror')) {
        return new DOMParser().parseFromString(xml, 'text/html').documentElement;
      }
      return xmlDoc.documentElement;
    } catch {
      return null;
    }
  }, [xml]);

  if (!root) return <div class="mono">Could not parse hierarchy dump.</div>;

  return (
    <div>
      <input
        class="tree-search mono"
        placeholder="search: resource-id, text, class…"
        value={query}
        onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
      />
      <div class="mono">
        <TreeNode el={root} query={query} depth={0} />
      </div>
    </div>
  );
}
