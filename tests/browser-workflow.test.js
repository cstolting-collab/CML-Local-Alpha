import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { DocumentStore } from '../store.js';
import { createHandler } from '../server.js';
// Small DOM fixture executes the actual UI module. It is not a rendering/browser test.
class Element {
  constructor(tag = 'div') { this.tag = tag; this.value = ''; this.children = []; this.events = {}; this.disabled = false; this.textContent = ''; }
  addEventListener(type, fn) { this.events[type] = fn; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  querySelectorAll(tag) { return this.children.flatMap(child => [ ...(child.tag === tag ? [child] : []), ...(child.querySelectorAll?.(tag) || []) ]); }
  focus() {}
  setSelectionRange(start, end) { this.selection = [start,end]; }
  click() { return this.events.click?.(); }
}
test('actual editor UI creates, autosaves, validates, imports, inspects and exports locally', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'cml-ui-test-')); t.after(() => rm(directory, { recursive: true, force: true }));
  const store = new DocumentStore(directory); const handler = createHandler(store); const nodes = new Map(); const blobs = [];
  const prior = Object.fromEntries(['document','window','localStorage','fetch'].map(name => [name, globalThis[name]]));
  globalThis.document = { getElementById(id) { if (!nodes.has(id)) nodes.set(id, new Element()); return nodes.get(id); }, createElement(tag) { return new Element(tag); }, createTextNode(text) { return { textContent: text }; } };
  globalThis.window = { addEventListener() {} }; const local = new Map(); globalThis.localStorage = { getItem: key => local.get(key), setItem: (key,value) => local.set(key,value) };
  globalThis.fetch = async (url, options = {}) => {
    const request = Readable.from(options.body ? [Buffer.from(options.body)] : []); request.method = options.method || 'GET'; request.url = url; request.headers = { host: '127.0.0.1:4180', origin: 'http://127.0.0.1:4180' };
    let status, data; await handler(request, { writeHead(s) { status=s; }, end(value) { data=value; } }); return { ok: status < 400, json: async () => JSON.parse(data) };
  };
  const originalURL = URL.createObjectURL; URL.createObjectURL = blob => { blobs.push(blob); return originalURL(blob); };
  t.after(() => { URL.createObjectURL = originalURL; for (const [key,value] of Object.entries(prior)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; } });
  await import('../public/app.js'); const $ = id => nodes.get(id);
  assert.equal($('title').value, 'My first continuity'); assert.match($('source').value, /◎C/);
  await $('validate').click(); assert.equal($('verdict').textContent, 'Accepted'); assert.ok($('state-summary').children.length); assert.match($('canonical').textContent, /CANONICAL CONTINUITY PLAN/);
  const acceptedIR = $('ir').textContent;
  $('source').value = $('source').value.replace('  □L target=world\n', ''); $('source').events.input(); assert.equal($('receipt').disabled, true);
  await new Promise(resolve => setTimeout(resolve, 800)); assert.match($('save-status').textContent, /Saved locally/); await $('validate').click(); assert.equal($('verdict').textContent, 'Failed'); assert.equal($('ir').textContent, acceptedIR); assert.ok($('issues').children.length);
  await $('receipt').click(); const failedReceipt = JSON.parse(await blobs.at(-1).text()); assert.equal(failedReceipt.verdict, 'FAIL'); assert.equal(failedReceipt.lastAccepted.valid, true);
  await $('new').click(); assert.equal($('title').value, 'Untitled continuity'); assert.equal($('accepted-revision').textContent, 'None');
  const title = '<img src=x onerror=alert(1)>'; const content = new TextEncoder().encode('not a CML document'); $('file').files = [{ name: title + '.cml', size: content.length, arrayBuffer: async () => content.buffer }]; await $('file').events.change();
  assert.equal($('title').value, title); assert.equal($('source').value, 'not a CML document'); await $('validate').click(); assert.equal($('verdict').textContent, 'Failed'); assert.equal($('accepted-revision').textContent, 'None');
  const rows = await store.list(); const original = rows.find(row => row.title === 'My first continuity'); const buttons = $('documents').children; const originalButton = buttons.find(button => button.children[0].textContent === original.title); await originalButton.click();
  assert.equal($('title').value, original.title); assert.equal($('verdict').textContent, 'Failed'); assert.equal($('ir').textContent, acceptedIR); assert.equal($('history').children.length, 2);
  const persisted = await new DocumentStore(directory).get(original.id); assert.equal(persisted.source, $('source').value);
});
