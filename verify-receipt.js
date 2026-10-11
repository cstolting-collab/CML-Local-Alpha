import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { verifyReceiptIntegrity } from './receipt-integrity.js';
import { verifyReceiptSignature } from './receipt-signature.js';

export function verifyReceipt(receipt, { trustedKey } = {}) {
  const result = verifyReceiptIntegrity(receipt);
  const authentication = receipt.schemaVersion === 2 || trustedKey !== undefined
    ? verifyReceiptSignature(receipt, trustedKey)
    : { status: 'unsigned', keyId: null };
  return {
    ...result,
    authentication,
    externalExecutionVerified: false,
    note: authentication.status === 'trusted-signature'
      ? 'Integrity, static compiler result, and signature under the supplied trusted key verified. Associate that key with its owner separately. External execution and historical time are not verified.'
      : 'Integrity and static compiler result verified. This unsigned receipt does not authenticate a signer or establish external execution.',
  };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { values, positionals } = parseArgs({ options: { 'trusted-key': { type: 'string' } }, allowPositionals: true });
    if (positionals.length !== 1) throw new Error('Usage: node verify-receipt.js <receipt.json> [--trusted-key <public.pem>]');
    const trustedKey = values['trusted-key'] === undefined ? undefined : await readFile(values['trusted-key'], 'utf8');
    console.log(JSON.stringify(verifyReceipt(JSON.parse(await readFile(positionals[0], 'utf8')), { trustedKey }), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
