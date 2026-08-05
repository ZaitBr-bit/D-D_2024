#!/usr/bin/env node
// Minimal, dependency-free static file server used for local test running
// (Playwright suites, Node integration tests). Serves a given root directory
// over plain HTTP, never following path traversal outside of it.

import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const DEFAULT_ROOT = '.';
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 4173;

const MIME_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.htm', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.ico', 'image/x-icon'],
  ['.webmanifest', 'application/manifest+json'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.txt', 'text/plain; charset=utf-8'],
]);
const DEFAULT_MIME = 'application/octet-stream';

/**
 * Parses server CLI arguments into a plain options object.
 * Recognized flags: --root, --host, --port. Unknown flags raise an error.
 *
 * @param {ReadonlyArray<string>} argv
 * @returns {{ root: string, host: string, port: number }}
 */
export function parseServerArgs(argv) {
  const result = { root: DEFAULT_ROOT, host: DEFAULT_HOST, port: DEFAULT_PORT };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--root':
        result.root = argv[++i];
        break;
      case '--host':
        result.host = argv[++i];
        break;
      case '--port':
        result.port = Number(argv[++i]);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return result;
}

/**
 * Resolves a raw request URL against a server root, rejecting any attempt to
 * escape the root via path traversal. Query strings are ignored. This is
 * purely path arithmetic — it does not touch the filesystem.
 *
 * @param {string} root
 * @param {string} requestUrl
 * @returns {{ ok: true, value: string } | { ok: false, code: string, message: string }}
 */
export function resolveRequestPath(root, requestUrl) {
  const absoluteRoot = path.resolve(root);

  const withoutHash = requestUrl.split('#')[0];
  const withoutQuery = withoutHash.split('?')[0];

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(withoutQuery);
  } catch {
    return { ok: false, code: 'BAD_REQUEST', message: 'Malformed request URL' };
  }

  // Reject literal backslashes outright. On win32, `path.join`/`path.resolve`
  // treat `\` as a path separator just like `/`, so a decoded segment such as
  // `\..\..\..\Windows\System32` (from a request like
  // `/foo/%5C..%5C..%5C..%5CWindows%5CSystem32`) would sail through a
  // `/`-only split as one opaque "segment", only to be re-interpreted as
  // multiple `..` hops once handed to `path.join` below — escaping the root.
  // Backslashes have no legitimate meaning in a URL path, so refuse them.
  if (decodedPath.includes('\\')) {
    return { ok: false, code: 'FORBIDDEN', message: 'Path traversal is not allowed' };
  }

  // Resolve "." / ".." segments ourselves (rather than relying on the URL
  // parser's implicit normalization) so any attempt to climb above the
  // server root is explicitly rejected instead of silently clamped.
  const stack = [];
  for (const segment of decodedPath.split('/')) {
    if (segment === '' || segment === '.') {
      continue;
    }
    if (segment === '..') {
      if (stack.length === 0) {
        return { ok: false, code: 'FORBIDDEN', message: 'Path traversal is not allowed' };
      }
      stack.pop();
      continue;
    }
    stack.push(segment);
  }

  const candidate = path.join(absoluteRoot, ...stack);

  // Independent final gate: regardless of which separator or encoding might
  // have been used to build `candidate`, verify it did not end up outside
  // `absoluteRoot`. This is defense in depth on top of the checks above.
  const relativeToRoot = path.relative(absoluteRoot, candidate);
  const escapesRoot =
    relativeToRoot === '..' ||
    relativeToRoot.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeToRoot);
  if (escapesRoot) {
    return { ok: false, code: 'FORBIDDEN', message: 'Path traversal is not allowed' };
  }

  return { ok: true, value: candidate };
}

function getMimeType(filePath) {
  return MIME_TYPES.get(path.extname(filePath).toLowerCase()) ?? DEFAULT_MIME;
}

async function handleRequest(root, req, res) {
  const resolved = resolveRequestPath(root, req.url ?? '/');

  if (!resolved.ok) {
    res.writeHead(resolved.code === 'BAD_REQUEST' ? 400 : 403, {
      'content-type': 'text/plain; charset=utf-8',
    });
    res.end(resolved.message);
    return;
  }

  let targetPath = resolved.value;

  try {
    let stats = await stat(targetPath);
    if (stats.isDirectory()) {
      targetPath = path.join(targetPath, 'index.html');
      stats = await stat(targetPath);
    }

    const body = await readFile(targetPath);
    res.writeHead(200, {
      'content-type': getMimeType(targetPath),
      'content-length': body.length,
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  }
}

/**
 * Creates and starts a static HTTP server rooted at `root`.
 *
 * @param {{ root: string, host: string, port: number }} options
 * @returns {Promise<{ host: string, port: number, url: string, close: () => Promise<void> }>}
 */
export function createStaticServer({ root, host, port }) {
  const absoluteRoot = path.resolve(root);

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      handleRequest(absoluteRoot, req, res).catch((error) => {
        res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
        res.end(`Internal Server Error: ${error.message}`);
      });
    });

    server.on('error', reject);

    server.listen(port, host, () => {
      const address = server.address();
      const boundPort = typeof address === 'object' && address !== null ? address.port : port;
      resolve({
        host,
        port: boundPort,
        url: `http://${host}:${boundPort}/`,
        close: () =>
          new Promise((resolveClose, rejectClose) => {
            server.close((closeError) => {
              if (closeError) {
                rejectClose(closeError);
              } else {
                resolveClose();
              }
            });
          }),
      });
    });
  });
}

async function main() {
  const options = parseServerArgs(process.argv.slice(2));
  const handle = await createStaticServer(options);

  console.log(`[serve-static] Serving ${path.resolve(options.root)} at ${handle.url}`);

  const shutdown = async (signal) => {
    console.log(`[serve-static] Received ${signal}, shutting down...`);
    try {
      await handle.close();
      process.exit(0);
    } catch (error) {
      console.error('[serve-static] Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

const isMainModule =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMainModule) {
  main();
}
