import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const rawBasePath = process.env.PAGES_BASE_PATH || '/telemetriq/';
const basePath = rawBasePath === '/'
  ? '/'
  : `/${rawBasePath.replace(/^\/+|\/+$/g, '')}/`;
const distRoot = resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const port = Number(process.env.PORT || 4173);
const host = '127.0.0.1';
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json',
};

const server = createServer((request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url || '/', `http://${host}`).pathname);
  } catch {
    response.writeHead(400).end('Bad request');
    return;
  }

  if (basePath !== '/' && pathname === basePath.slice(0, -1)) {
    response.writeHead(308, { Location: basePath }).end();
    return;
  }
  if (!pathname.startsWith(basePath)) {
    response.writeHead(404).end('Not found');
    return;
  }

  const relativePath = pathname.slice(basePath.length) || 'index.html';
  const filePath = resolve(distRoot, relativePath);
  if (filePath !== distRoot && !filePath.startsWith(`${distRoot}${sep}`)) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const stats = statSync(filePath);
    if (!stats.isFile()) {
      response.writeHead(404).end('Not found');
      return;
    }
    response.writeHead(200, {
      'Content-Type': contentTypes[extname(filePath)] || 'application/octet-stream',
      'Cache-Control': filePath.endsWith('.html') ? 'no-cache' : 'public, max-age=31536000, immutable',
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404).end('Not found');
  }
});

server.listen(port, host, () => {
  console.log(`Serving Pages build at http://${host}:${port}${basePath}`);
});
