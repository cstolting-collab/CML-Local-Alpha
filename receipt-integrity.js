import { hash, validateDocument, fingerprint } from './validator.js';

// Content consistency only. Use verifyReceipt() for signature and trust policy.
export function verifyReceiptIntegrity(receipt) {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt) ||
      receipt.format !== 'CML-Local-Verification-Receipt' || ![1, 2].includes(receipt.schemaVersion)) {
    throw new Error('Unknown receipt format.');
  }
  if (receipt.schemaVersion === 1 && (Object.hasOwn(receipt, 'signature') || Object.hasOwn(receipt, 'signing'))) {
    throw new Error('Unsigned schema-1 receipts must not contain signing fields.');
  }
  const { receiptSha256, ...body } = receipt;
  if (receipt.schemaVersion === 2) delete body.signature;
  if (typeof receiptSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(receiptSha256) || hash(JSON.stringify(body)) !== receiptSha256) {
    throw new Error('Receipt digest mismatch.');
  }
  if (receipt.compiler.fingerprintSha256 !== fingerprint) throw new Error('Receipt uses a different compiler snapshot.');
  const actual = validateDocument(receipt.document.source);
  if (actual.sourceSha256 !== receipt.document.sourceSha256 || actual.sourceSha256 !== receipt.validation.sourceSha256) throw new Error('Source digest mismatch.');
  if (actual.valid !== receipt.validation.valid || (actual.valid ? 'PASS' : 'FAIL') !== receipt.verdict || actual.irSha256 !== receipt.validation.irSha256 || JSON.stringify(actual.ir) !== JSON.stringify(receipt.validation.ir) || JSON.stringify(actual.issues) !== JSON.stringify(receipt.validation.issues)) throw new Error('Recomputed validation differs from receipt.');
  if (receipt.lastAccepted) {
    const accepted = validateDocument(receipt.lastAccepted.source);
    if (!accepted.valid || accepted.sourceSha256 !== receipt.lastAccepted.sourceSha256 || accepted.irSha256 !== receipt.lastAccepted.irSha256 || JSON.stringify(accepted.ir) !== JSON.stringify(receipt.lastAccepted.ir)) throw new Error('Last accepted state does not match its source.');
  }
  return { verified: true, verdict: receipt.verdict, sourceSha256: actual.sourceSha256 };
}
