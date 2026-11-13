import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist/pwa/browser');
const port = Number(process.env.PORT ?? 4202);
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain',
};
await stat(path.join(root, 'index.html'));
const index = await readFile(path.join(root, 'index.html'), 'utf8');
const basePath = /<base href="([^"]+)"/.exec(index)?.[1] ?? '/';
createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname === '/' && basePath !== '/') {
      response.writeHead(302, { Location: basePath, 'Cache-Control': 'no-store' });
      response.end();
      return;
    }
    if (!url.pathname.startsWith(basePath)) throw new Error('Outside app scope');
    const pathname = url.pathname.slice(basePath.length - 1);
    let file = path.resolve(root, '.' + decodeURIComponent(pathname));
    const relative = path.relative(root, file);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Invalid path');
    if (!relative || url.pathname.endsWith('/')) file = path.join(file, 'index.html');
    const bytes = await readFile(file);
    response.writeHead(200, {
      'Content-Type': mime[path.extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    response.end(request.method === 'HEAD' ? undefined : bytes);
  } catch {
    response.writeHead(404, { 'Cache-Control': 'no-store' });
    response.end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`PWA preview: http://127.0.0.1:${port}${basePath}`));
