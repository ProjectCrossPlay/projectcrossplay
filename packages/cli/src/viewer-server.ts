/**
 * Local server for `crossplay show-trace` (B-041, ADR-004). Serves the
 * self-contained Preact viewer bundle plus the raw trace file bytes; the
 * viewer does 100% of the parsing client-side (NFR-018 — no server-side
 * trust boundary to bypass, a dropped-in file is parsed identically).
 *
 * Security posture (NFR-016): binds 127.0.0.1 only, ephemeral OS-assigned
 * port, a random path token so nothing else on the machine can guess the
 * URL, and a strict CSP with no external origins allowed at all.
 */
import { randomBytes } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer, type Server } from 'node:http';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { CrossPlayError } from '@projectcrossplay/core';

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

const CSP = "default-src 'self'; img-src 'self' blob:; script-src 'self'; style-src 'self'; connect-src 'self'";

export interface ViewerServer {
  url: string;
  close(): Promise<void>;
}

function viewerDistDir(): string {
  const require = createRequire(import.meta.url);
  let pkgJson: string;
  try {
    pkgJson = require.resolve('@projectcrossplay/trace-viewer/package.json');
  } catch {
    throw new CrossPlayError({
      what: '@projectcrossplay/trace-viewer is not installed',
      next: ['reinstall the CLI (it depends on trace-viewer directly)'],
    });
  }
  const dist = join(dirname(pkgJson), 'dist');
  if (!existsSync(join(dist, 'index.html'))) {
    throw new CrossPlayError({
      what: 'trace-viewer bundle is missing (dist/index.html not found)',
      next: ['pnpm --filter @projectcrossplay/trace-viewer build'],
    });
  }
  return dist;
}

/** Start the viewer server for one trace file. Caller closes it when done. */
export async function startViewerServer(tracePath: string): Promise<ViewerServer> {
  const dist = viewerDistDir();
  const token = randomBytes(16).toString('hex');
  const prefix = `/${token}`;

  const server: Server = createServer((req, res) => {
    const url = req.url ?? '/';
    if (!url.startsWith(prefix)) {
      res.writeHead(404).end('not found');
      return;
    }
    const rel = url.slice(prefix.length) || '/';
    res.setHeader('content-security-policy', CSP);
    res.setHeader('x-content-type-options', 'nosniff');

    if (rel === '/trace.data') {
      res.setHeader('content-type', 'application/octet-stream');
      createReadStream(tracePath).pipe(res);
      return;
    }

    const path = normalize(rel === '/' ? '/index.html' : rel).replace(/^(\.\.[/\\])+/, '');
    const filePath = join(dist, path);
    // Refuse to serve anything outside dist/ (defense in depth vs path
    // traversal). Without the trailing separator, a bare startsWith(dist)
    // would also match a sibling directory like dist-evil/ that merely
    // shares the prefix — join()'s own '..'-collapsing already prevents
    // real traversal, but this check must not have that gap regardless.
    const distRoot = dist.endsWith(sep) ? dist : dist + sep;
    if (!filePath.startsWith(distRoot)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    if (!existsSync(filePath)) {
      res.writeHead(404).end('not found');
      return;
    }
    res.setHeader('content-type', CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream');
    createReadStream(filePath).pipe(res);
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;

  return {
    url: `http://127.0.0.1:${port}${prefix}/`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/** Best-effort cross-platform browser open; failure just means print the URL. */
export async function tryOpenBrowser(url: string): Promise<boolean> {
  const { spawn } = await import('node:child_process');
  const cmd =
    process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : ['xdg-open', [url]];
  try {
    const child = spawn(cmd[0] as string, cmd[1] as string[], { stdio: 'ignore', detached: true });
    child.unref();
    return true;
  } catch {
    return false;
  }
}
