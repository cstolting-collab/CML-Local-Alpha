import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSigningKeyPair } from './receipt-keys.js';

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 3 || process.argv[2].startsWith('-')) throw new Error('Usage: node receipt-key.js <new-private-key-directory>');
    console.log(JSON.stringify(await createSigningKeyPair(process.argv[2]), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
