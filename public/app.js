import { EditorSession } from './session.js';
const $ = id => document.getElementById(id);
let timer; let busy = false;
async function api(method, path, body) {
  const response = await fetch(path, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Local request failed.'); return result;
}
const session = new EditorSession(api);
function message(error) { $('error').hidden = !error; $('error').textContent = error?.message || ''; }
function remember(id) { try { localStorage.setItem('cml-alpha-selected', id); } catch {} }
function remembered() { try { return localStorage.getItem('cml-alpha-selected'); } catch { return null; } }
function current() { return session.doc && $('title').value.trim() === session.doc.title && $('source').value === session.doc.source; }
function checked() { return current() && session.doc.lastValidation?.revision === session.doc.revision; }
function render(adopt = false) {
  const d = session.doc; if (!d) return;
  if (adopt) { $('title').value = d.title; $('source').value = d.source; }
  const v = d.lastValidation; const isChecked = checked();
  $('save-status').textContent = current() ? 'Saved locally · r' + d.revision : 'Unsaved edits';
  $('verdict').textContent = isChecked ? (v.valid ? 'Accepted' : 'Failed') : 'Not checked';
  $('verdict').className = 'badge ' + (isChecked ? (v.valid ? 'pass' : 'fail') : 'idle');
  $('validation-note').textContent = isChecked ? (v.valid ? 'This draft passed the compiler’s static continuity rules.' : 'This draft failed. Review the issues below; the last accepted state is preserved.') : 'The current draft needs validation. Previous checks remain in the history.';
  $('issues').replaceChildren();
  if (isChecked) for (const issue of v.issues) {
    const box = document.createElement('div'); box.className = 'issue';
    const code = document.createElement('strong'); code.textContent = issue.code + ' · ' + (issue.severity || 'error');
    const text = document.createElement('p'); text.textContent = issue.message; box.append(code, text);
    const line = issue.location?.line ?? issue.source?.line;
    if (line) { const jump = document.createElement('button'); jump.textContent = 'Go to line ' + line; jump.addEventListener('click', () => { const lines = $('source').value.split('\n'); const start = lines.slice(0, line - 1).reduce((sum, x) => sum + x.length + 1, 0); $('source').focus(); $('source').setSelectionRange(start, start + (lines[line - 1]?.length || 0)); }); box.append(jump); }
    if (issue.suggestion) { const help = document.createElement('p'); help.textContent = issue.suggestion; box.append(help); }
    $('issues').append(box);
  }
  $('checked').textContent = isChecked ? 'SOURCE SHA-256\n' + v.sourceSha256 : '';
  $('receipt').disabled = busy || !isChecked;
  const a = d.accepted; $('accepted-revision').textContent = a ? 'Revision ' + a.revision : 'None'; $('accepted-revision').className = 'badge ' + (a ? 'pass' : 'idle');
  $('accepted-note').textContent = !a ? 'No version has been accepted yet.' : a.revision === d.revision && current() ? 'The accepted state matches this draft.' : 'This is an earlier accepted revision. It does not represent your current draft.';
  $('canonical').textContent = a?.canonical || 'No accepted plan.'; $('ir').textContent = a ? JSON.stringify(a.ir, null, 2) : 'No accepted state.';
  $('accepted-hash').textContent = a ? 'ACCEPTED IR SHA-256\n' + a.irSha256 : '';
  $('state-summary').replaceChildren();
  if (a) {
    const scenes = (a.ir.projects || []).flatMap(p => p.scenes || []);
    for (const scene of scenes) { const row = document.createElement('div'); row.className = 'state'; const name = document.createElement('strong'); name.textContent = scene.id; const info = document.createElement('span'); info.textContent = (scene.instructions || []).length + ' instructions'; row.append(name, info); $('state-summary').append(row); }
  }
  $('history').replaceChildren();
  for (const item of [...d.history].reverse()) { const li = document.createElement('li'); const label = document.createElement('b'); label.textContent = (item.valid ? 'PASS' : 'FAIL') + ' · r' + item.revision; li.append(label, document.createTextNode(' · ' + new Date(item.validatedAt).toLocaleString())); $('history').append(li); }
}
async function library() {
  const rows = await api('GET', '/api/documents'); $('count').textContent = rows.length; $('documents').replaceChildren();
  for (const d of rows) { const button = document.createElement('button'); button.className = 'doc' + (session.doc?.id === d.id ? ' active' : ''); const title = document.createElement('strong'); title.textContent = d.title; const note = document.createElement('small'); note.textContent = d.error || ('r' + d.revision + ' · ' + (d.valid === true ? 'Accepted' : d.valid === false ? 'Failed' : 'Draft')); button.append(title, note); button.disabled = busy; button.addEventListener('click', () => task(async () => { await flush(); await session.open(d.id); remember(d.id); render(true); await library(); })); $('documents').append(button); }
  return rows;
}
async function save() { if (!session.doc) return; const title = $('title').value, source = $('source').value; await session.save(title, source); render(); }
async function flush() { clearTimeout(timer); if (session.doc && !current()) await save(); await session.queue; }
async function task(action) {
  if (busy) return; busy = true; message(null);
  for (const id of ['new','import','save','validate','download','receipt','title','source']) $(id).disabled = true;
  for (const button of $('documents').querySelectorAll('button')) button.disabled = true;
  try { await action(); } catch (error) { message(error); }
  finally { busy = false; for (const id of ['new','import','save','validate','download','title','source']) $(id).disabled = false; render(); await library().catch(message); }
}
function download(name, content, type) { const url = URL.createObjectURL(new Blob([content], { type })); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function filename() { return ($('title').value.replace(/[^a-z0-9_-]+/gi, '-').slice(0, 70) || 'continuity'); }
for (const id of ['title','source']) $(id).addEventListener('input', () => { clearTimeout(timer); render(); timer = setTimeout(() => save().then(() => library()).catch(message), 600); });
$('new').addEventListener('click', () => task(async () => { await flush(); await session.create('Untitled continuity'); remember(session.doc.id); render(true); }));
$('save').addEventListener('click', () => task(flush));
$('validate').addEventListener('click', () => task(async () => { clearTimeout(timer); await session.validate($('title').value, $('source').value); render(); }));
$('import').addEventListener('click', () => $('file').click());
$('file').addEventListener('change', () => task(async () => { const file = $('file').files[0]; if (!file) return; if (file.size > 262144) throw new Error('File exceeds the 256 KiB document limit.'); const source = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()); await flush(); await session.create(file.name.replace(/\.(cml|txt)$/i, '').slice(0, 120) || 'Imported continuity', source); remember(session.doc.id); render(true); $('file').value = ''; }));
$('download').addEventListener('click', () => task(async () => { await flush(); download(filename() + '.cml', session.doc.source, 'text/plain;charset=utf-8'); }));
$('receipt').addEventListener('click', () => task(async () => { await flush(); const receipt = await session.receipt(); download(filename() + '.verification.json', JSON.stringify(receipt, null, 2), 'application/json'); }));
window.addEventListener('beforeunload', event => { if (session.doc && !current()) { event.preventDefault(); event.returnValue = ''; } });
await task(async () => { const rows = await library(); const previous = remembered(); if (rows.length) await session.open(rows.some(d => d.id === previous && !d.error) ? previous : rows.find(d => !d.error)?.id || rows[0].id); else await session.create('My first continuity'); remember(session.doc.id); render(true); });
