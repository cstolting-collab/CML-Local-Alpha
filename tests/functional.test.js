import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { DocumentStore } from '../store.js';
import { SAMPLE, validateDocument, hash, provenance } from '../validator.js';
import { createHandler } from '../server.js';
import { EditorSession } from '../public/session.js';
import { verifyReceipt } from '../verify-receipt.js';
const invalid = SAMPLE.replace('  □L target=world\n', '');
async function setup(t) { const directory = await mkdtemp(join(tmpdir(), 'cml-alpha-test-')); t.after(() => rm(directory, { recursive: true, force: true })); return { directory, store: new DocumentStore(directory) }; }
async function request(handler, method, path, body, headers = {}) {
  const bytes = body === undefined ? [] : [Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))];
  const req = Readable.from(bytes); req.method = method; req.url = path; req.headers = { host: '127.0.0.1:4180', ...headers };
  let status, responseHeaders, data;
  await handler(req, { writeHead(code, headers) { status = code; responseHeaders = headers; }, end(value) { data = value; } });
  const text = data?.toString() || ''; return { status, headers: responseHeaders, text, data: responseHeaders['content-type'].startsWith('application/json') ? JSON.parse(text) : text };
}
function gateway(handler) { return async (method, path, body) => { const r = await request(handler, method, path, body); if (r.status >= 400) throw new Error(r.data.error); return r.data; }; }
test('vendored compiler snapshot matches recorded provenance byte for byte', async () => {
  for (const [name, expected] of Object.entries(provenance.files)) assert.equal(hash(await readFile(new URL('../vendor/compiler/' + name, import.meta.url))), expected, name);
});
test('real compiler accepts starter and returns canonical and normalized state', () => {
  const v = validateDocument(SAMPLE); assert.equal(v.valid, true); assert.equal(v.ir.projects[0].scenes[0].id, 'my_scene'); assert.match(v.canonical, /CANONICAL CONTINUITY PLAN/); assert.equal(v.sourceSha256, hash(SAMPLE));
});
test('real compiler reports semantic failures with code and source line', () => {
  const v = validateDocument(invalid); assert.equal(v.valid, false); assert.ok(v.issues.some(i => i.code === 'CML-E109')); assert.equal(v.ir, null);
});
test('syntax failure is a visible validation result', () => {
  const v = validateDocument('not a CML document'); assert.equal(v.valid, false); assert.ok(v.issues[0].code.startsWith('CML-')); assert.ok(v.issues[0].message);
});
test('create, validate, persist and reopen accepted state after process reload', async t => {
  const { directory, store } = await setup(t); const d = await store.create({ title: 'Unicode ◎', source: SAMPLE });
  const checked = await store.validate(d.id, { revision: d.revision }); assert.equal(checked.accepted.source, SAMPLE);
  const restarted = new DocumentStore(directory); assert.deepEqual(await restarted.get(d.id), checked); assert.equal((await restarted.list())[0].valid, true);
});
test('failed edit preserves earlier accepted state and exports a FAIL receipt', async t => {
  const { store } = await setup(t); let d = await store.create(); d = await store.validate(d.id, { revision: d.revision }); const accepted = structuredClone(d.accepted);
  d = await store.update(d.id, { title: d.title, source: invalid, revision: d.revision }); d = await store.validate(d.id, { revision: d.revision });
  assert.equal(d.lastValidation.valid, false); assert.deepEqual(d.accepted, accepted); const receipt = await store.receipt(d.id); assert.equal(receipt.verdict, 'FAIL'); assert.equal(receipt.document.source, invalid); assert.equal(receipt.lastAccepted.source, SAMPLE); assert.equal(verifyReceipt(receipt).verified, true);
});
test('unvalidated or changed draft cannot export a stale PASS receipt', async t => {
  const { store } = await setup(t); let d = await store.create(); await assert.rejects(store.receipt(d.id), { status: 409 }); d = await store.validate(d.id, { revision: 1 });
  d = await store.update(d.id, { title: 'Changed name', source: d.source, revision: d.revision }); await assert.rejects(store.receipt(d.id), { status: 409 }); assert.equal((await store.list())[0].valid, null);
});
test('PASS receipt recomputes with exact source and IR and rejects tampering', async t => {
  const { store } = await setup(t); const d = await store.create(); await store.validate(d.id, { revision: 1 }); const r = await store.receipt(d.id); assert.equal(verifyReceipt(r).verdict, 'PASS');
  const changed = structuredClone(r); changed.document.source += '\n'; assert.throws(() => verifyReceipt(changed), /digest/);
  const forged = structuredClone(r); forged.validation.valid = false; const { receiptSha256, ...body } = forged; forged.receiptSha256 = hash(JSON.stringify(body)); assert.throws(() => verifyReceipt(forged), /validation differs/);
});
test('failed first validation has no accepted state', async t => {
  const { store } = await setup(t); const d = await store.create({ source: invalid }); const checked = await store.validate(d.id, { revision: 1 }); assert.equal(checked.accepted, null); assert.equal((await store.receipt(d.id)).verdict, 'FAIL');
});
test('concurrent windows cannot overwrite an unseen revision', async t => {
  const { store } = await setup(t); const d = await store.create();
  const outcomes = await Promise.allSettled(['One', 'Two'].map(title => store.update(d.id, { title, source: d.source, revision: 1 })));
  assert.equal(outcomes.filter(r => r.status === 'fulfilled').length, 1); assert.equal(outcomes.find(r => r.status === 'rejected').reason.status, 409); assert.equal((await store.get(d.id)).revision, 2);
});
test('invalid IDs, title, source size and revision validation are rejected', async t => {
  const { store } = await setup(t); await assert.rejects(store.get('../escape'), { status: 400 }); await assert.rejects(store.create({ title: '' }), { status: 400 }); await assert.rejects(store.create({ source: 'x'.repeat(262145) }), { status: 413 });
  const d = await store.create(); await assert.rejects(store.validate(d.id, { revision: 999 }), { status: 409 }); await assert.rejects(store.get('00000000-0000-0000-0000-000000000000'), { status: 404 });
});
test('atomic local writes leave no temporary file and use private permissions', async t => {
  const { store, directory } = await setup(t); const d = await store.create(); await store.validate(d.id, { revision: 1 }); assert.deepEqual(await readdir(directory), [d.id + '.json']); assert.equal((await stat(join(directory, d.id + '.json'))).mode & 0o777, 0o600);
});
test('corrupt saved document is surfaced and preserved', async t => {
  const { store, directory } = await setup(t); const d = await store.create(); const path = join(directory, d.id + '.json'); await writeFile(path, '{broken'); await assert.rejects(store.get(d.id), { status: 500 }); assert.equal((await store.list())[0].error.includes('preserved'), true); assert.equal(await readFile(path, 'utf8'), '{broken');
});
test('history keeps the last twenty checks without losing accepted state', async t => {
  const { store } = await setup(t); const d = await store.create(); for (let i=0;i<22;i++) await store.validate(d.id, { revision: 1 }); const saved = await store.get(d.id); assert.equal(saved.history.length, 20); assert.equal(saved.accepted.valid, true);
});
test('local API browser workflow creates, edits, validates, exports and reloads', async t => {
  const { store, directory } = await setup(t); const ui = new EditorSession(gateway(createHandler(store))); const created = await ui.create('Loaded continuity', SAMPLE); await ui.validate(created.title, created.source); assert.equal((await ui.receipt()).verdict, 'PASS');
  await ui.save(created.title, invalid); await ui.validate(created.title, invalid); const failed = await ui.receipt(); assert.equal(failed.verdict, 'FAIL'); assert.ok(failed.lastAccepted);
  const reopened = new EditorSession(gateway(createHandler(new DocumentStore(directory)))); await reopened.open(created.id); assert.equal(reopened.doc.source, invalid); assert.equal(reopened.doc.history.length, 2); assert.equal(verifyReceipt(await reopened.receipt()).verified, true);
});
test('browser autosave and validation operations serialize without losing latest edit', async t => {
  const { store } = await setup(t); const ui = new EditorSession(gateway(createHandler(store))); await ui.create('First', SAMPLE);
  await Promise.all([ui.save('Second', SAMPLE + '\n'), ui.validate('Latest', invalid)]); assert.equal(ui.doc.title, 'Latest'); assert.equal(ui.doc.source, invalid); assert.equal(ui.doc.lastValidation.revision, ui.doc.revision);
});
test('static routes serve UI and modules with local content policy', async t => {
  const { store } = await setup(t); const handler = createHandler(store);
  for (const path of ['/', '/app.js', '/session.js', '/style.css']) { const r = await request(handler, 'GET', path); assert.equal(r.status, 200); assert.ok(r.text.length > 100); assert.match(r.headers['content-security-policy'], /connect-src 'self'/); }
  assert.equal((await request(handler, 'HEAD', '/')).text, ''); assert.equal((await request(handler, 'GET', '/../../store.js')).status, 404);
});
test('API rejects cross-origin and unexpected hosts', async t => {
  const { store } = await setup(t); const handler = createHandler(store); assert.equal((await request(handler, 'POST', '/api/documents', {}, { origin: 'https://example.com' })).status, 403); assert.equal((await request(handler, 'GET', '/api/documents', undefined, { host: 'example.com' })).status, 403);
});
test('API rejects malformed and oversized JSON and unsupported operations', async t => {
  const { store } = await setup(t); const handler = createHandler(store);
  for (const body of ['{', 'null', '[]']) assert.equal((await request(handler, 'POST', '/api/documents', body)).status, 400);
  assert.equal((await request(handler, 'POST', '/api/documents', 'x'.repeat(300001))).status, 413);
  const created = await request(handler, 'POST', '/api/documents', {}); assert.equal(created.status, 201); assert.equal((await request(handler, 'DELETE', '/api/documents/' + created.data.id)).status, 405); assert.equal((await request(handler, 'GET', '/api/cloud')).status, 404);
});
