import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, KeyObject } from 'node:crypto';
import { constants } from 'node:fs';
import { mkdir, open, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

export function privateSigningKey(value) {
  let key;
  try { key = value instanceof KeyObject ? value : createPrivateKey(value); }
  catch { throw new Error('Signing key must be an Ed25519 private key.'); }
  if (key.type !== 'private' || key.asymmetricKeyType !== 'ed25519') throw new Error('Signing key must be an Ed25519 private key.');
  return key;
}

export function trustedPublicKey(value) {
  let key;
  try {
    if (value instanceof KeyObject) key = value;
    else {
      if (!(typeof value === 'string' || Buffer.isBuffer(value)) || !value.toString().includes('-----BEGIN PUBLIC KEY-----')) throw new Error();
      key = createPublicKey(value);
    }
  } catch { throw new Error('Trusted key must be an Ed25519 public key in SPKI PEM format.'); }
  if (key.type !== 'public' || key.asymmetricKeyType !== 'ed25519') throw new Error('Trusted key must be an Ed25519 public key.');
  return key;
}

export function keyFingerprint(value) {
  const key = trustedPublicKey(value);
  return 'sha256:' + createHash('sha256').update(key.export({ type: 'spki', format: 'der' })).digest('hex');
}

function requirePrivateKeyFilesystem() {
  if (process.platform === 'win32') throw new Error('Create and load private signing keys in WSL or another POSIX environment; native Windows ACL protection is not implemented.');
}

export async function loadPrivateSigningKey(path) {
  requirePrivateKeyFilesystem();
  // Nonblocking open lets the regular-file check reject FIFOs without waiting
  // for another process to write to them.
  const file = await open(path, constants.O_RDONLY | constants.O_NONBLOCK);
  try {
    const info = await file.stat();
    if (!info.isFile()) throw new Error('Signing key path must name a regular file.');
    if ((info.mode & 0o077) !== 0) throw new Error('Signing key permissions must exclude group and other access (use mode 600).');
    return privateSigningKey(await file.readFile('utf8'));
  } finally { await file.close(); }
}

export async function createSigningKeyPair(directory) {
  requirePrivateKeyFilesystem();
  const target = resolve(directory);
  await mkdir(dirname(target), { recursive: true, mode: 0o700 });
  // Exclusive directory creation prevents accidental key replacement or rotation.
  await mkdir(target, { mode: 0o700 });
  if (((await stat(target)).mode & 0o077) !== 0) throw new Error('Key directory must enforce private POSIX permissions; use the WSL Linux home directory.');
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const privateKeyPath = join(target, 'signing.private.pem');
  const publicKeyPath = join(target, 'signing.public.pem');
  const privateFile = await open(privateKeyPath, 'wx', 0o600);
  try {
    if (((await privateFile.stat()).mode & 0o077) !== 0) throw new Error('Private key file must enforce mode 600 before key material can be written.');
    await privateFile.writeFile(privateKey.export({ type: 'pkcs8', format: 'pem' }));
  } finally { await privateFile.close(); }
  await writeFile(publicKeyPath, publicKey.export({ type: 'spki', format: 'pem' }), { flag: 'wx', mode: 0o644 });
  return { privateKeyPath, publicKeyPath, keyId: keyFingerprint(publicKey) };
}
