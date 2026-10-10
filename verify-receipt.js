import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hash, validateDocument, fingerprint } from './validator.js';
export function verifyReceipt(receipt) {
  const { receiptSha256, ...body } = receipt;
  if (hash(JSON.stringify(body)) !== receiptSha256) throw new Error('Receipt digest mismatch.');
  if (receipt.format !== 'CML-Local-Verification-Receipt' || receipt.schemaVersion !== 1) throw new Error('Unknown receipt format.');
  if (receipt.compiler.fingerprintSha256 !== fingerprint) throw new Error('Receipt uses a different compiler snapshot.');
  const actual = validateDocument(receipt.document.source);
  if (actual.sourceSha256 !== receipt.document.sourceSha256 || actual.sourceSha256 !== receipt.validation.sourceSha256) throw new Error('Source digest mismatch.');
  if (actual.valid !== receipt.validation.valid || (actual.valid ? 'PASS' : 'FAIL') !== receipt.verdict || actual.irSha256 !== receipt.validation.irSha256 || JSON.stringify(actual.ir) !== JSON.stringify(receipt.validation.ir) || JSON.stringify(actual.issues) !== JSON.stringify(receipt.validation.issues)) throw new Error('Recomputed validation differs from receipt.');
  if (receipt.lastAccepted) {
    const accepted = validateDocument(receipt.lastAccepted.source);
    if (!accepted.valid || accepted.sourceSha256 !== receipt.lastAccepted.sourceSha256 || accepted.irSha256 !== receipt.lastAccepted.irSha256 || JSON.stringify(accepted.ir) !== JSON.stringify(receipt.lastAccepted.ir)) throw new Error('Last accepted state does not match its source.');
  }
  return { verified: true, verdict: receipt.verdict, sourceSha256: actual.sourceSha256, note: 'Integrity and local compiler result verified. This unsigned receipt does not establish author identity or external execution.' };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (!process.argv[2]) throw new Error('Usage: node verify-receipt.js <receipt.json>');
    console.log(JSON.stringify(verifyReceipt(JSON.parse(await readFile(process.argv[2], 'utf8'))), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
