// Shared browser workflow: operations are serialized, including autosave and validation.
export class EditorSession {
  constructor(api) { this.api = api; this.doc = null; this.queue = Promise.resolve(); }
  serial(action) { const next = this.queue.then(action); this.queue = next.catch(() => {}); return next; }
  open(id) { return this.serial(async () => this.doc = await this.api('GET', '/api/documents/' + id)); }
  create(title, source) { return this.serial(async () => this.doc = await this.api('POST', '/api/documents', { title, source })); }
  save(title, source) { return this.serial(async () => {
    if (!this.doc) throw new Error('Create or load a document first.');
    this.doc = await this.api('PUT', '/api/documents/' + this.doc.id, { title, source, revision: this.doc.revision }); return this.doc;
  }); }
  validate(title, source) { return this.serial(async () => {
    if (!this.doc) throw new Error('Create or load a document first.');
    this.doc = await this.api('PUT', '/api/documents/' + this.doc.id, { title, source, revision: this.doc.revision });
    this.doc = await this.api('POST', '/api/documents/' + this.doc.id + '/validate', { revision: this.doc.revision }); return this.doc;
  }); }
  receipt() { return this.serial(async () => this.api('GET', '/api/documents/' + this.doc.id + '/receipt')); }
}
