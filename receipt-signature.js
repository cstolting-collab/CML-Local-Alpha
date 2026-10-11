import { createPublicKey, sign, verify } from 'node:crypto';
import { hash } from './validator.js';
import { verifyReceiptIntegrity } from './receipt-integrity.js';
import { privateSigningKey, trustedPublicKey, keyFingerprint } from './receipt-keys.js';

export { keyFingerprint } from './receipt-keys.js';

const SIGNING_DOMAIN = 'CML-Local-Verification-Receipt/v2\0';

export function signReceipt(receipt, privateKey) {
  verifyReceiptIntegrity(receipt);
  if (receipt.schemaVersion !== 1) throw new Error('Sign an unsigned schema-1 receipt; an existing signature must not be replaced.');
  const key = privateSigningKey(privateKey);
  const body = { ...receipt, schemaVersion: 2, signing: { algorithm: 'Ed25519', keyId: keyFingerprint(createPublicKey(key)) } };
  delete body.receiptSha256;
  const receiptSha256 = hash(JSON.stringify(body));
  const signature = sign(null, Buffer.from(SIGNING_DOMAIN + receiptSha256, 'utf8'), key).toString('base64');
  return { ...body, receiptSha256, signature };
}

export function verifyReceiptSignature(receipt, trustedKey) {
  if (receipt.schemaVersion !== 2) throw new Error('A signed schema-2 receipt is required when a trusted key is supplied.');
  const metadata = receipt.signing;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata) ||
      Object.keys(metadata).sort().join(',') !== 'algorithm,keyId' || metadata.algorithm !== 'Ed25519' ||
      typeof metadata.keyId !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(metadata.keyId)) {
    throw new Error('Invalid receipt signing metadata or unsupported algorithm.');
  }
  if (typeof receipt.signature !== 'string' || !/^[A-Za-z0-9+/]{86}==$/.test(receipt.signature)) throw new Error('Missing or malformed Ed25519 receipt signature.');
  const signature = Buffer.from(receipt.signature, 'base64');
  if (signature.length !== 64 || signature.toString('base64') !== receipt.signature) throw new Error('Malformed Ed25519 receipt signature encoding.');
  if (trustedKey === undefined) throw new Error('A trusted public key is required to verify a signed receipt; supply --trusted-key.');
  const key = trustedPublicKey(trustedKey);
  const keyId = keyFingerprint(key);
  if (metadata.keyId !== keyId) throw new Error('Receipt signer does not match the trusted public key.');
  if (!verify(null, Buffer.from(SIGNING_DOMAIN + receipt.receiptSha256, 'utf8'), key, signature)) throw new Error('Receipt signature verification failed.');
  return { status: 'trusted-signature', keyId };
}
