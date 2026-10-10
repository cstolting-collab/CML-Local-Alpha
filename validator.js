import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { compileSource } from './vendor/compiler/src/compiler.js';
import { exportCanonicalText } from './vendor/compiler/exporters/canonical-text.js';
import { COMPILER_VERSION } from './vendor/compiler/src/version.js';
export const hash = value => createHash('sha256').update(value).digest('hex');
export const provenance = JSON.parse(readFileSync(new URL('./evidence/COMPILER_PROVENANCE.json', import.meta.url)));
export const fingerprint = hash(JSON.stringify(provenance.files));
export const SAMPLE = `◎C my_scene {
  □L target=character
  □L target=world
  ~F target=camera mode=slow
  ♪V text="The whole mountain listens." words=5 speed=0.95
  |P duration=2200ms
  ·S duration=1800ms zero=true
  ⌒R type=smile delay=900ms settle=1200ms hold=true
  ↑L target=-23LUFS after=continuity
}`;
export function validateDocument(source) {
  if (typeof source !== 'string') throw new TypeError('Source must be text.');
  try {
    const result = compileSource(source);
    return { valid: result.validation.valid, sourceSha256: hash(source), compilerVersion: COMPILER_VERSION,
      issues: result.validation.issues, ir: result.ir,
      canonical: result.ir ? exportCanonicalText(result.ir) : null,
      irSha256: result.ir ? hash(JSON.stringify(result.ir)) : null };
  } catch (error) {
    if (!error.code?.startsWith('CML-')) throw error;
    return { valid: false, sourceSha256: hash(source), compilerVersion: COMPILER_VERSION,
      issues: [error.toJSON()], ir: null, canonical: null, irSha256: null };
  }
}
