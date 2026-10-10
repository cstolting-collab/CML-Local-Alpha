import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateDocument } from '../validator.js';
import { DocumentStore } from '../store.js';
import { verifyReceipt } from '../verify-receipt.js';

const valid = await readFile(new URL('./sample-valid.cml', import.meta.url), 'utf8');
const invalid = await readFile(new URL('./sample-invalid-missing-world.cml', import.meta.url), 'utf8');
const expected = JSON.parse(await readFile(new URL('./expected-invalid-edit.json', import.meta.url), 'utf8'));
assert.equal(invalid, valid.replace('  □L target=world\n', ''));
assert.equal(validateDocument(valid).valid, true);
const actual = validateDocument(invalid);
assert.equal(actual.valid, false);
assert.deepEqual(actual.issues, [{ code: 'CML-E109', severity: 'error',
  message: "Block 'my_scene' requires LOCK target=world.",
  location: { line: 1, column: 1 }, source: null }]);
for (const key of Object.keys(actual)) assert.deepEqual(actual[key], expected[key], key);
const directory = await mkdtemp(join(tmpdir(), 'cml-tester-fixtures-'));
try {
  const store = new DocumentStore(directory);
  let document = await store.create({ title: 'Tester fixture', source: valid });
  document = await store.validate(document.id, { revision: document.revision });
  const accepted = structuredClone(document.accepted);
  assert.equal(verifyReceipt(await store.receipt(document.id)).verdict, 'PASS');
  document = await store.update(document.id, { title: document.title, source: invalid, revision: document.revision });
  document = await store.validate(document.id, { revision: document.revision });
  assert.deepEqual(document.accepted, accepted);
  assert.equal(verifyReceipt(await store.receipt(document.id)).verdict, 'FAIL');
  assert.deepEqual(await new DocumentStore(directory).get(document.id), document);
  console.log('PASS: valid fixture, exact CML-E109, PASS/FAIL receipts, accepted-state preservation, and store reload.');
} finally {
  await rm(directory, { recursive: true, force: true });
}
