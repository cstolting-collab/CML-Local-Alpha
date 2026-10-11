import { mkdir, readFile, readdir, open, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateDocument, hash, fingerprint, provenance, SAMPLE } from './validator.js';
import { privateSigningKey } from './receipt-keys.js';
import { signReceipt } from './receipt-signature.js';
export class AppError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function checkDraft(title, source) {
  if (typeof title !== 'string' || !title.trim() || title.length > 120) throw new AppError(400, 'Use a document name of 1–120 characters.');
  if (typeof source !== 'string' || Buffer.byteLength(source) > 262144) throw new AppError(413, 'Document must be UTF-8 text no larger than 256 KiB.');
}
export class DocumentStore {
  constructor(directory, { signingKey } = {}) {
    this.directory = directory; this.queue = Promise.resolve();
    this.signingKey = signingKey === undefined ? undefined : privateSigningKey(signingKey);
  }
  serial(action) { const next = this.queue.then(action); this.queue = next.catch(() => {}); return next; }
  path(id) {
    if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(id)) throw new AppError(400, 'Invalid document ID.');
    return join(this.directory, id + '.json');
  }
  async read(id) {
    let data;
    try { data = JSON.parse(await readFile(this.path(id), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') throw new AppError(404, 'Document not found.'); if (error instanceof AppError) throw error; throw new AppError(500, 'The saved document cannot be read. Its file has been preserved.'); }
    if (data.schemaVersion !== 1 || data.id !== id || typeof data.title !== 'string' || typeof data.source !== 'string') throw new AppError(500, 'Unrecognized saved document. Its file has been preserved.');
    return data;
  }
  async write(doc) {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const temporary = this.path(doc.id) + '.' + randomUUID() + '.tmp';
    const file = await open(temporary, 'wx', 0o600);
    try { await file.writeFile(JSON.stringify(doc, null, 2)); await file.sync(); }
    finally { await file.close(); }
    try {
      await rename(temporary, this.path(doc.id));
      const directory = await open(this.directory, 'r');
      try { await directory.sync(); } finally { await directory.close(); }
    } catch (error) { await unlink(temporary).catch(() => {}); throw error; }
    return doc;
  }
  create({ title = 'Untitled continuity', source = SAMPLE } = {}) {
    return this.serial(async () => {
      checkDraft(title, source); const now = new Date().toISOString();
      return this.write({ schemaVersion: 1, id: randomUUID(), title: title.trim(), source, revision: 1,
        createdAt: now, updatedAt: now, lastValidation: null, accepted: null, history: [] });
    });
  }
  get(id) { return this.serial(() => this.read(id)); }
  list() { return this.serial(async () => {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const files = await readdir(this.directory); const rows = [];
    for (const name of files.filter(name => /^[a-f0-9-]{36}\.json$/.test(name))) {
      try { const d = await this.read(name.slice(0, -5)); rows.push({ id: d.id, title: d.title, revision: d.revision, updatedAt: d.updatedAt, valid: d.lastValidation?.revision === d.revision ? d.lastValidation.valid : null }); }
      catch (error) { rows.push({ id: name.slice(0, -5), title: 'Unreadable saved document', error: error.message }); }
    }
    return rows.sort((a,b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }); }
  update(id, { title, source, revision }) { return this.serial(async () => {
    checkDraft(title, source); const d = await this.read(id);
    if (revision !== d.revision) throw new AppError(409, 'This document changed in another window. Reload it before saving.');
    if (title.trim() === d.title && source === d.source) return d;
    d.title = title.trim(); d.source = source; d.revision++; d.updatedAt = new Date().toISOString(); return this.write(d);
  }); }
  validate(id, { revision } = {}) { return this.serial(async () => {
    const d = await this.read(id);
    if (revision !== d.revision) throw new AppError(409, 'Save the current revision before validating.');
    const checked = validateDocument(d.source);
    d.lastValidation = { ...checked, revision: d.revision, validatedAt: new Date().toISOString() };
    if (checked.valid) d.accepted = { ...d.lastValidation, source: d.source, title: d.title };
    d.history = [...d.history, { valid: checked.valid, revision: d.revision, sourceSha256: checked.sourceSha256, validatedAt: d.lastValidation.validatedAt, issues: checked.issues }].slice(-20);
    return this.write(d);
  }); }
  receipt(id) { return this.serial(async () => {
    const d = await this.read(id); const v = d.lastValidation;
    if (!v || v.revision !== d.revision || v.sourceSha256 !== hash(d.source)) throw new AppError(409, 'Validate the current draft before exporting its receipt.');
    const result = { format: 'CML-Local-Verification-Receipt', schemaVersion: 1, appVersion: '0.1.0',
      exportedAt: new Date().toISOString(), scope: 'Static CML document validation; no runtime execution, renderer verification, timing guarantee, or launch authority.',
      verdict: v.valid ? 'PASS' : 'FAIL', document: { id: d.id, title: d.title, revision: d.revision, source: d.source, sourceSha256: v.sourceSha256 },
      validation: v, lastAccepted: d.accepted, compiler: { version: v.compilerVersion, fingerprintSha256: fingerprint, files: provenance.files },
      localOnly: true, launchAuthorized: false };
    const receipt = { ...result, receiptSha256: hash(JSON.stringify(result)) };
    return this.signingKey === undefined ? receipt : signReceipt(receipt, this.signingKey);
  }); }
}
