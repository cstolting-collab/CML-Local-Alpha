import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createPublicKey, generateKeyPairSync, sign as cryptoSign, verify as cryptoVerify } from 'node:crypto';
import { chmod, mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { signReceipt, keyFingerprint } from '../receipt-signature.js';
import { createSigningKeyPair, loadPrivateSigningKey } from '../receipt-keys.js';
import { verifyReceipt } from '../verify-receipt.js';
import { DocumentStore } from '../store.js';
import { SAMPLE } from '../validator.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const pass = JSON.parse(await readFile(new URL('../examples/sample-pass.verification.json', import.meta.url), 'utf8'));
const fail = JSON.parse(await readFile(new URL('../examples/sample-fail.verification.json', import.meta.url), 'utf8'));
// Test identities are generated in memory for this run and never enter the repository.
const signer = generateKeyPairSync('ed25519');
const stranger = generateKeyPairSync('ed25519');
const unsupported = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const privatePem = signer.privateKey.export({ type: 'pkcs8', format: 'pem' });
const publicPem = signer.publicKey.export({ type: 'spki', format: 'pem' });
const sha256 = value => createHash('sha256').update(value).digest('hex');
const expectedKeyId = 'sha256:' + sha256(signer.publicKey.export({ type: 'spki', format: 'der' }));
const prefix = 'CML-Local-Verification-Receipt/v2\0';
const clone = value => structuredClone(value);

async function temporary(t) {
  const directory = await mkdtemp(join(tmpdir(), 'cml-receipt-signing-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}
function rehashSigned(receipt) {
  const { receiptSha256, signature, ...body } = receipt;
  return { ...receipt, receiptSha256: sha256(JSON.stringify(body)) };
}
function rehashLegacy(receipt) {
  const { receiptSha256, ...body } = receipt;
  return { ...receipt, receiptSha256: sha256(JSON.stringify(body)) };
}
// Independent signing bypasses the production signer's input checks, so a valid
// signature cannot conceal a regression in the verifier's compiler checks.
function signUnchecked(receipt) {
  const result = rehashSigned(receipt);
  result.signature = cryptoSign(null, Buffer.from(prefix + result.receiptSha256), signer.privateKey).toString('base64');
  return result;
}
function cli(script, args = []) {
  const result = spawnSync(process.execPath, [join(root, script), ...args], {
    cwd: root, encoding: 'utf8', timeout: 15000,
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null, 'CLI must exit normally rather than terminate by signal');
  return result;
}
function assertPrivateMaterialAbsent(text, privateKey = signer.privateKey) {
  assert.doesNotMatch(text, /BEGIN (?:ENCRYPTED )?PRIVATE KEY/);
  assert.ok(!text.includes(privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64')), 'private DER must not be exported');
  assert.ok(!text.includes(privateKey.export({ format: 'jwk' }).d), 'private seed must not be exported');
}

test('published schema-1 PASS and FAIL receipts remain explicitly unsigned', () => {
  for (const original of [pass, fail]) {
    const before = clone(original);
    const result = verifyReceipt(original);
    assert.equal(result.verified, true);
    assert.equal(result.verdict, original.verdict);
    assert.deepEqual(result.authentication, { status: 'unsigned', keyId: null });
    assert.equal(result.externalExecutionVerified, false);
    assert.deepEqual(original, before);
    assert.throws(() => verifyReceipt(original, { trustedKey: signer.publicKey }));
  }
});

test('Ed25519 PASS and FAIL signatures preserve receipt data and verify with independently supplied public keys', () => {
  assert.equal(keyFingerprint(signer.publicKey), expectedKeyId);
  assert.equal(keyFingerprint(publicPem), expectedKeyId);
  for (const original of [pass, fail]) {
    const before = clone(original);
    const signed = signReceipt(original, original.verdict === 'PASS' ? signer.privateKey : privatePem);
    const { receiptSha256, signature, signing, ...signedFields } = signed;
    const { receiptSha256: oldDigest, ...originalFields } = original;
    assert.deepEqual(signedFields, { ...originalFields, schemaVersion: 2 });
    assert.deepEqual(signing, { algorithm: 'Ed25519', keyId: expectedKeyId });
    assert.match(receiptSha256, /^[a-f0-9]{64}$/);
    assert.equal(Buffer.from(signature, 'base64').length, 64);
    assert.equal(Buffer.from(signature, 'base64').toString('base64'), signature);
    assert.equal(receiptSha256, rehashSigned(signed).receiptSha256);
    assert.equal(cryptoVerify(null, Buffer.from(prefix + receiptSha256), signer.publicKey, Buffer.from(signature, 'base64')), true);
    assert.equal(cryptoVerify(null, Buffer.from(receiptSha256), signer.publicKey, Buffer.from(signature, 'base64')), false, 'signature must include its receipt-specific domain');
    const result = verifyReceipt(signed, { trustedKey: original.verdict === 'PASS' ? signer.publicKey : publicPem });
    assert.equal(result.verified, true);
    assert.equal(result.verdict, original.verdict);
    assert.deepEqual(result.authentication, { status: 'trusted-signature', keyId: expectedKeyId });
    assert.equal(result.externalExecutionVerified, false);
    assert.deepEqual(original, before, 'signing must not mutate the original unsigned receipt');
  }
});

test('a signed receipt cannot supply its own trust or silently fall back to unsigned verification', () => {
  const signed = signReceipt(pass, signer.privateKey);
  for (const options of [undefined, {}, { trustedKey: undefined }, { trustedKey: null }]) {
    assert.throws(() => verifyReceipt(signed, options));
  }
  const embedded = signUnchecked({ ...signed, publicKey: publicPem });
  assert.throws(() => verifyReceipt(embedded));
});

test('wrong signer identities, key algorithms, and invalid trust material fail closed', () => {
  const signed = signReceipt(pass, signer.privateKey);
  for (const trustedKey of [stranger.publicKey, unsupported.publicKey, 'not a PEM key', {}, Buffer.from('invalid key')]) {
    assert.throws(() => verifyReceipt(signed, { trustedKey }));
  }
  for (const privateKey of [signer.publicKey, unsupported.privateKey, 'not a PEM key', null, {}]) {
    assert.throws(() => signReceipt(pass, privateKey));
  }
  assert.throws(() => keyFingerprint(unsupported.publicKey));
});

test('body edits remain rejected after an attacker recomputes the public digest', () => {
  const original = signReceipt(pass, signer.privateKey);
  const edits = [
    r => { r.document.title = 'Different owner claim'; },
    r => { r.document.source += '\n'; },
    r => { r.exportedAt = '2000-01-01T00:00:00.000Z'; },
    r => { r.scope = 'Externally executed'; },
    r => { r.localOnly = false; },
    r => { r.launchAuthorized = true; },
    r => { r.verdict = 'FAIL'; },
    r => { r.lastAccepted = null; },
    r => { r.compiler.version = 'different'; },
  ];
  for (const edit of edits) {
    const changed = clone(original); edit(changed);
    assert.throws(() => verifyReceipt(changed, { trustedKey: signer.publicKey }));
    assert.throws(() => verifyReceipt(rehashSigned(changed), { trustedKey: signer.publicKey }));
  }
});

test('a valid trusted signature does not bypass compiler, source, validation, or accepted-state checks', () => {
  const original = signReceipt(pass, signer.privateKey);
  const edits = [
    r => { r.compiler.fingerprintSha256 = '0'.repeat(64); },
    r => { r.document.sourceSha256 = '0'.repeat(64); },
    r => { r.validation.sourceSha256 = '0'.repeat(64); },
    r => { r.document.source += '\n'; },
    r => { r.validation.irSha256 = '0'.repeat(64); },
    r => { r.validation.ir.projects[0].scenes[0].id = 'forged_scene'; },
    r => { r.validation.issues = [{ code: 'FAKE', message: 'forged issue' }]; },
    r => { r.verdict = 'FAIL'; },
    r => { r.lastAccepted.source = 'invalid source'; },
  ];
  for (const edit of edits) {
    const changed = clone(original); edit(changed);
    const forged = signUnchecked(changed);
    assert.equal(cryptoVerify(null, Buffer.from(prefix + forged.receiptSha256), signer.publicKey, Buffer.from(forged.signature, 'base64')), true);
    assert.throws(() => verifyReceipt(forged, { trustedKey: signer.publicKey }));
  }
});

test('stripping or downgrading authentication cannot satisfy a request for trusted verification', () => {
  const signed = signReceipt(pass, signer.privateKey);
  for (const field of ['signature', 'signing']) {
    const stripped = clone(signed); delete stripped[field];
    assert.throws(() => verifyReceipt(rehashSigned(stripped), { trustedKey: signer.publicKey }));
  }
  const downgraded = { ...signed, schemaVersion: 1 };
  assert.throws(() => verifyReceipt(rehashLegacy(downgraded)));
  delete downgraded.signing; delete downgraded.signature;
  const unsigned = rehashLegacy(downgraded);
  assert.throws(() => verifyReceipt(unsigned, { trustedKey: signer.publicKey }));
  assert.deepEqual(verifyReceipt(unsigned).authentication, { status: 'unsigned', keyId: null });
  for (const field of ['signing', 'signature']) {
    const disguised = rehashLegacy({ ...clone(pass), [field]: signed[field] });
    assert.throws(() => verifyReceipt(disguised));
  }
});

test('signatures require canonical base64 encoding and exactly 64 valid signature bytes', () => {
  const signed = signReceipt(pass, signer.privateKey);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const finalCharacter = signed.signature.at(-3);
  const noncanonical = signed.signature.slice(0, -3) + alphabet[alphabet.indexOf(finalCharacter) + 1] + '==';
  assert.deepEqual(Buffer.from(noncanonical, 'base64'), Buffer.from(signed.signature, 'base64'), 'alternate padding bits decode to the same signature');
  const invalid = [
    '', null, {}, [], Buffer.alloc(64).toString('base64'), Buffer.alloc(63).toString('base64'),
    Buffer.alloc(65).toString('base64'), signed.signature.slice(0, -2), signed.signature + '\n', noncanonical,
  ];
  for (const signature of invalid) assert.throws(() => verifyReceipt({ ...signed, signature }, { trustedKey: signer.publicKey }));
});

test('signed metadata and schema cannot be relabeled even with a fresh valid signature', () => {
  const original = signReceipt(pass, signer.privateKey);
  const edits = [
    r => { r.signing.algorithm = 'RSA'; },
    r => { r.signing.keyId = 'sha256:' + '0'.repeat(64); },
    r => { r.signing.keyId = expectedKeyId.toUpperCase(); },
    r => { delete r.signing.keyId; },
    r => { r.signing = null; },
    r => { r.signing = []; },
    r => { r.schemaVersion = '2'; },
    r => { r.schemaVersion = 3; },
  ];
  for (const edit of edits) {
    const changed = clone(original); edit(changed);
    assert.throws(() => verifyReceipt(signUnchecked(changed), { trustedKey: signer.publicKey }));
  }
});

test('signing accepts only valid unsigned receipts and never repairs corrupted evidence', () => {
  const badDigest = clone(pass); badDigest.document.title += ' changed';
  const badValidation = clone(pass); badValidation.validation.valid = false;
  const candidates = [null, [], {}, badDigest, rehashLegacy(badValidation), signReceipt(pass, signer.privateKey),
    rehashLegacy({ ...clone(pass), signing: { algorithm: 'Ed25519', keyId: expectedKeyId } }),
    rehashLegacy({ ...clone(pass), signature: 'unexpected' })];
  for (const receipt of candidates) assert.throws(() => signReceipt(receipt, signer.privateKey));
});

test('configured stores export authenticated PASS and FAIL receipts while preserving last accepted state', async t => {
  const directory = await temporary(t);
  const store = new DocumentStore(directory, { signingKey: privatePem });
  let document = await store.create();
  document = await store.validate(document.id, { revision: document.revision });
  const accepted = clone(document.accepted);
  const passed = await store.receipt(document.id);
  assert.equal(passed.schemaVersion, 2);
  assert.equal(verifyReceipt(passed, { trustedKey: signer.publicKey }).verdict, 'PASS');
  document = await store.update(document.id, { title: document.title, source: SAMPLE.replace('  □L target=world\n', ''), revision: document.revision });
  await assert.rejects(store.receipt(document.id), { status: 409 });
  document = await store.validate(document.id, { revision: document.revision });
  const restarted = new DocumentStore(directory, { signingKey: signer.privateKey });
  const failed = await restarted.receipt(document.id);
  assert.deepEqual(failed.lastAccepted, accepted);
  assert.equal(verifyReceipt(failed, { trustedKey: signer.publicKey }).verdict, 'FAIL');
  assert.equal(verifyReceipt(await new DocumentStore(directory).receipt(document.id)).authentication.status, 'unsigned');
});

test('invalid configured signing keys are rejected before a store can export unsigned receipts', async t => {
  const directory = await temporary(t);
  for (const signingKey of ['not a key', unsupported.privateKey, signer.publicKey, {}]) {
    assert.throws(() => new DocumentStore(directory, { signingKey }));
  }
  assert.deepEqual(await readdir(directory), []);
});

test('signed exports and stored documents contain no private signing material', async t => {
  const directory = await temporary(t);
  const store = new DocumentStore(directory, { signingKey: signer.privateKey });
  const document = await store.create();
  await store.validate(document.id, { revision: document.revision });
  const receipt = await store.receipt(document.id);
  assertPrivateMaterialAbsent(JSON.stringify(receipt));
  assertPrivateMaterialAbsent(JSON.stringify(verifyReceipt(receipt, { trustedKey: signer.publicKey })));
  for (const name of await readdir(directory)) assertPrivateMaterialAbsent(await readFile(join(directory, name), 'utf8'));
});

test('key generation creates a private new directory, usable keys, and refuses all overwrites', async t => {
  const directory = join(await temporary(t), 'identity');
  const generated = await createSigningKeyPair(directory);
  assert.equal(generated.privateKeyPath, join(directory, 'signing.private.pem'));
  assert.equal(generated.publicKeyPath, join(directory, 'signing.public.pem'));
  assert.deepEqual((await readdir(directory)).sort(), ['signing.private.pem', 'signing.public.pem']);
  const privateBytes = await readFile(generated.privateKeyPath);
  const publicBytes = await readFile(generated.publicKeyPath);
  if (process.platform !== 'win32') {
    assert.equal((await stat(directory)).mode & 0o777, 0o700);
    assert.equal((await stat(generated.privateKeyPath)).mode & 0o777, 0o600);
  }
  const key = await loadPrivateSigningKey(generated.privateKeyPath);
  const publicKey = createPublicKey(publicBytes);
  assert.equal(key.asymmetricKeyType, 'ed25519');
  assert.equal(generated.keyId, keyFingerprint(publicKey));
  assert.equal(verifyReceipt(signReceipt(pass, key), { trustedKey: publicKey }).authentication.keyId, generated.keyId);
  await assert.rejects(createSigningKeyPair(directory));
  assert.deepEqual(await readFile(generated.privateKeyPath), privateBytes);
  assert.deepEqual(await readFile(generated.publicKeyPath), publicBytes);
});

test('private-key loading rejects absent, malformed, non-Ed25519, non-file, and exposed keys', async t => {
  const directory = await temporary(t);
  await assert.rejects(loadPrivateSigningKey(join(directory, 'missing.pem')));
  await assert.rejects(loadPrivateSigningKey(directory));
  const file = join(directory, 'key.pem');
  for (const contents of ['invalid key', publicPem, unsupported.privateKey.export({ type: 'pkcs8', format: 'pem' })]) {
    await writeFile(file, contents, { mode: 0o600 });
    await assert.rejects(loadPrivateSigningKey(file));
  }
  await writeFile(file, privatePem, { mode: 0o600 });
  assert.equal((await loadPrivateSigningKey(file)).asymmetricKeyType, 'ed25519');
  if (process.platform !== 'win32') {
    await chmod(file, 0o644);
    await assert.rejects(loadPrivateSigningKey(file));
    await chmod(file, 0o600);
  }
});

test('CLI key generation, signing, and trusted verification work without changing the original receipt', async t => {
  const directory = await temporary(t);
  const identity = join(directory, 'identity');
  const generated = cli('receipt-key.js', [identity]);
  assert.equal(generated.status, 0, generated.stderr);
  const key = await loadPrivateSigningKey(join(identity, 'signing.private.pem'));
  assertPrivateMaterialAbsent(generated.stdout + generated.stderr, key);
  const original = join(directory, 'original.json');
  const output = join(directory, 'signed.json');
  const bytes = JSON.stringify(pass, null, 2) + '\n';
  await writeFile(original, bytes);
  const signed = cli('sign-receipt.js', [original, '--private-key', join(identity, 'signing.private.pem'), '--output', output]);
  assert.equal(signed.status, 0, signed.stderr);
  assert.equal(await readFile(original, 'utf8'), bytes);
  assertPrivateMaterialAbsent(signed.stdout + signed.stderr + await readFile(output, 'utf8'), key);
  const verified = cli('verify-receipt.js', [output, '--trusted-key', join(identity, 'signing.public.pem')]);
  assert.equal(verified.status, 0, verified.stderr);
  const result = JSON.parse(verified.stdout);
  assert.equal(result.verified, true);
  assert.equal(result.verdict, 'PASS');
  assert.equal(result.authentication.status, 'trusted-signature');
  assert.equal(result.externalExecutionVerified, false);
  assertPrivateMaterialAbsent(verified.stdout + verified.stderr, key);
});

test('signing CLI cannot replace an existing output or the original input', async t => {
  const directory = await temporary(t);
  const keyPath = join(directory, 'private.pem');
  const input = join(directory, 'receipt.json');
  const output = join(directory, 'existing.json');
  const original = JSON.stringify(pass);
  await writeFile(keyPath, privatePem, { mode: 0o600 });
  await writeFile(input, original);
  await writeFile(output, 'existing evidence\n');
  for (const target of [output, input]) {
    const result = cli('sign-receipt.js', [input, '--private-key', keyPath, '--output', target]);
    assert.notEqual(result.status, 0);
    assertPrivateMaterialAbsent(result.stdout + result.stderr);
  }
  assert.equal(await readFile(input, 'utf8'), original);
  assert.equal(await readFile(output, 'utf8'), 'existing evidence\n');
});

test('verification CLI rejects missing or wrong trust, invalid options, and unsigned receipts when trust is requested', async t => {
  const directory = await temporary(t);
  const signedPath = join(directory, 'signed.json');
  const unsignedPath = join(directory, 'unsigned.json');
  const publicPath = join(directory, 'public.pem');
  const wrongPath = join(directory, 'wrong.pem');
  await writeFile(signedPath, JSON.stringify(signReceipt(pass, signer.privateKey)));
  await writeFile(unsignedPath, JSON.stringify(pass));
  await writeFile(publicPath, publicPem);
  await writeFile(wrongPath, stranger.publicKey.export({ type: 'spki', format: 'pem' }));
  const cases = [
    [], [signedPath], [signedPath, '--trusted-key'], [signedPath, '--trusted-key', wrongPath],
    [signedPath, '--trusted-key', join(directory, 'missing.pem')], [signedPath, '--unknown-option'],
    [unsignedPath, '--trusted-key', publicPath],
  ];
  for (const args of cases) {
    const result = cli('verify-receipt.js', args);
    assert.notEqual(result.status, 0, 'invalid CLI verification must fail');
    assert.doesNotMatch(result.stdout, /"verified"\s*:\s*true/);
  }
  const unsigned = cli('verify-receipt.js', [unsignedPath]);
  assert.equal(unsigned.status, 0, unsigned.stderr);
  assert.equal(JSON.parse(unsigned.stdout).authentication.status, 'unsigned');
});

test('key and signing CLIs reject invalid inputs without creating output or modifying existing keys', async t => {
  const directory = await temporary(t);
  const input = join(directory, 'receipt.json');
  const keyPath = join(directory, 'invalid.pem');
  const output = join(directory, 'must-not-exist.json');
  await writeFile(input, JSON.stringify(pass));
  await writeFile(keyPath, 'invalid key', { mode: 0o600 });
  for (const args of [[], [input], [input, '--private-key', keyPath, '--output', output], [input, '--private-key', join(directory, 'missing.pem'), '--output', output]]) {
    assert.notEqual(cli('sign-receipt.js', args).status, 0);
    await assert.rejects(stat(output), { code: 'ENOENT' });
  }
  await writeFile(keyPath, privatePem, { mode: 0o600 });
  await writeFile(input, '{invalid JSON');
  assert.notEqual(cli('sign-receipt.js', [input, '--private-key', keyPath, '--output', output]).status, 0);
  await assert.rejects(stat(output), { code: 'ENOENT' });
  const existing = join(directory, 'existing');
  await mkdir(existing);
  await writeFile(join(existing, 'keep.txt'), 'preserve existing directory');
  assert.notEqual(cli('receipt-key.js', [existing]).status, 0);
  assert.deepEqual(await readdir(existing), ['keep.txt']);
  assert.equal(await readFile(join(existing, 'keep.txt'), 'utf8'), 'preserve existing directory');
  assert.notEqual(cli('receipt-key.js').status, 0);
});

test('native Windows private-key operations fail before creating or reading files', async t => {
  const directory = join(await temporary(t), 'must-not-create');
  const descriptor = Object.getOwnPropertyDescriptor(process, 'platform');
  try {
    Object.defineProperty(process, 'platform', { ...descriptor, value: 'win32' });
    await assert.rejects(createSigningKeyPair(directory), /WSL/);
    await assert.rejects(loadPrivateSigningKey(join(directory, 'private.pem')), /WSL/);
    assert.equal(verifyReceipt(signReceipt(pass, signer.privateKey), { trustedKey: publicPem }).authentication.status, 'trusted-signature');
  } finally { Object.defineProperty(process, 'platform', descriptor); }
  await assert.rejects(stat(directory), { code: 'ENOENT' });
});

test('server refuses a configured missing or invalid signing key before listening', async t => {
  const directory = await temporary(t);
  const invalidKeyPath = join(directory, 'invalid.private.pem');
  const dataPath = join(directory, 'documents-must-not-exist');
  await writeFile(invalidKeyPath, 'invalid key', { mode: 0o600 });
  for (const keyPath of ['', join(directory, 'missing.private.pem'), invalidKeyPath]) {
    const result = spawnSync(process.execPath, [join(root, 'server.js')], {
      cwd: root, encoding: 'utf8', timeout: 5000,
      env: { ...process.env, CML_RECEIPT_SIGNING_KEY: keyPath, CML_ALPHA_DATA_DIR: dataPath },
    });
    assert.ifError(result.error);
    assert.equal(result.status, 1, result.stderr);
    assert.equal(result.signal, null);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /Unable to start local server/);
    assertPrivateMaterialAbsent(result.stderr);
  }
  await assert.rejects(stat(dataPath), { code: 'ENOENT' });
});
