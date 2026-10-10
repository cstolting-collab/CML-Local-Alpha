import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DocumentStore, AppError } from './store.js';
const directory = fileURLToPath(new URL('./public/', import.meta.url));
export async function readJson(request) {
  let size = 0; const chunks = [];
  for await (const chunk of request) {
    size += chunk.length; if (size > 300000) throw new AppError(413, 'Request too large.'); chunks.push(chunk);
  }
  try { const body = JSON.parse(Buffer.concat(chunks).toString('utf8')); if (!body || Array.isArray(body) || typeof body !== 'object') throw new Error(); return body; }
  catch { throw new AppError(400, 'Expected a JSON object.'); }
}
const assets = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/session.js': ['session.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'] };
export function createHandler(store, expectedHost = '127.0.0.1:4180') {
  return async (req, res) => {
    const headers = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'" };
    const send = (status, value) => { res.writeHead(status, { ...headers, 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); };
    try {
      if (req.headers.host !== expectedHost) throw new AppError(403, 'Use the local application address.');
      if (req.headers.origin && req.headers.origin !== 'http://' + expectedHost) throw new AppError(403, 'Requests must come from this local application.');
      const url = new URL(req.url, 'http://' + expectedHost); const path = url.pathname;
      if ((req.method === 'GET' || req.method === 'HEAD') && assets[path]) {
        const [file, type] = assets[path]; const bytes = await readFile(join(directory, file)); res.writeHead(200, { ...headers, 'content-type': type + '; charset=utf-8' }); res.end(req.method === 'HEAD' ? undefined : bytes); return;
      }
      if (path === '/api/documents') {
        if (req.method === 'GET') return send(200, await store.list());
        if (req.method === 'POST') return send(201, await store.create(await readJson(req)));
      }
      const match = path.match(/^\/api\/documents\/([^/]+)(?:\/(validate|receipt))?$/);
      if (match) {
        const [, id, operation] = match;
        if (!operation && req.method === 'GET') return send(200, await store.get(id));
        if (!operation && req.method === 'PUT') return send(200, await store.update(id, await readJson(req)));
        if (operation === 'validate' && req.method === 'POST') return send(200, await store.validate(id, await readJson(req)));
        if (operation === 'receipt' && req.method === 'GET') return send(200, await store.receipt(id));
        throw new AppError(405, 'Method not allowed.');
      }
      throw new AppError(404, 'Not found.');
    } catch (error) { send(error.status || 500, { error: error.status ? error.message : 'Local operation failed. Your last saved document is preserved.' }); }
  };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const data = process.env.CML_ALPHA_DATA_DIR || join(homedir(), '.local', 'share', 'cml-local-alpha');
  const server = createServer(createHandler(new DocumentStore(data)));
  server.on('error', error => { console.error(`Unable to start local server: ${error.message}`); process.exitCode = 1; });
  server.listen(4180, '127.0.0.1', () => console.log(`CML Local Alpha: http://127.0.0.1:4180\nDocuments: ${data}\nPress Ctrl+C to stop.`));
}
