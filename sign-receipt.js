import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { loadPrivateSigningKey } from './receipt-keys.js';
import { signReceipt } from './receipt-signature.js';

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { values, positionals } = parseArgs({ options: { 'private-key': { type: 'string' }, output: { type: 'string' } }, allowPositionals: true });
    if (positionals.length !== 1 || !values['private-key'] || !values.output) throw new Error('Usage: node sign-receipt.js <receipt.json> --private-key <private.pem> --output <new-signed-receipt.json>');
    const receipt = JSON.parse(await readFile(positionals[0], 'utf8'));
    const signed = signReceipt(receipt, await loadPrivateSigningKey(values['private-key']));
    await writeFile(values.output, JSON.stringify(signed, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    console.log(JSON.stringify({ output: resolve(values.output), keyId: signed.signing.keyId, verdict: signed.verdict }, null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
