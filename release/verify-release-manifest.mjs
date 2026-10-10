#!/usr/bin/env node
/**
 * Verify the complete payload described by a release manifest.
 *
 * Run this against a freshly extracted archive or a dedicated staging directory,
 * never against a mutable repository checkout:
 *
 *   node release/verify-release-manifest.mjs \
 *     --root /path/to/extracted/cml-local-alpha-0.1.0-alpha.2 \
 *     --manifest /path/to/extracted/cml-local-alpha-0.1.0-alpha.2/release/cml-local-alpha-0.1.0-alpha.2.files.json \
 *     --expected-version 0.1.0-alpha.2
 *
 * It accepts either of these manifest shapes:
 *   { "files": [{ "path": "README.md", "sha256": "..." }] }
 *   { "files": { "README.md": "..." } }
 */
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SHA256 = /^[a-f0-9]{64}$/;
const ALPHA1_ARCHIVE = /(?:^|\/)[^/]*alpha\.1\.tar\.gz$/;

function fail(message) {
  throw new Error(`Invalid release manifest: ${message}`);
}

function normalizePath(value, label) {
  if (typeof value !== 'string' || value.length === 0) fail(`${label} must be a non-empty string`);
  if (value.includes('\\') || value.includes('\0') || isAbsolute(value)) fail(`${label} must be a safe relative POSIX path: ${value}`);
  const parts = value.split('/');
  if (parts.some(part => part.length === 0 || part === '.' || part === '..')) fail(`${label} must not contain empty, '.' or '..' segments: ${value}`);
  return parts.join('/');
}

function normalizeDigest(value, label) {
  if (typeof value !== 'string' || !SHA256.test(value)) fail(`${label} must be a lowercase SHA-256 hex digest`);
  return value;
}

function normalizeEntry(path, value, label) {
  const normalizedPath = normalizePath(path, `${label}.path`);
  const item = typeof value === 'string' ? { sha256: value } : value;
  if (!item || Array.isArray(item) || typeof item !== 'object') fail(`${label} must supply a SHA-256 digest`);
  const sha256 = normalizeDigest(item.sha256, `${label}.sha256`);
  let bytes;
  if (Object.hasOwn(item, 'bytes')) {
    if (!Number.isSafeInteger(item.bytes) || item.bytes < 0) fail(`${label}.bytes must be a non-negative integer`);
    bytes = item.bytes;
  }
  return { path: normalizedPath, sha256, bytes };
}

/**
 * Normalize both supported release-manifest layouts to a stable Map.
 */
export function parseManifest(manifest) {
  if (!manifest || Array.isArray(manifest) || typeof manifest !== 'object') fail('top-level value must be an object');
  if (!Object.hasOwn(manifest, 'files')) fail("missing required 'files' property");

  const entries = new Map();
  const add = (entry, label) => {
    if (entries.has(entry.path)) fail(`duplicate path: ${entry.path}`);
    entries.set(entry.path, entry);
  };

  if (Array.isArray(manifest.files)) {
    manifest.files.forEach((item, index) => {
      if (!item || Array.isArray(item) || typeof item !== 'object') fail(`files[${index}] must be an object`);
      add(normalizeEntry(item.path, item, `files[${index}]`), `files[${index}]`);
    });
  } else if (manifest.files && typeof manifest.files === 'object') {
    for (const [path, digest] of Object.entries(manifest.files)) add(normalizeEntry(path, digest, `files[${JSON.stringify(path)}]`));
  } else {
    fail("'files' must be an array or an object mapping paths to SHA-256 digests");
  }

  const version = manifest.version ?? manifest.build ?? null;
  if (version !== null && typeof version !== 'string') fail("'version' or 'build' must be a string when provided");
  return { entries, version };
}

function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function relativeWithin(root, absolute, label) {
  const output = relative(root, absolute);
  if (!output || output === '..' || output.startsWith(`..${sep}`) || isAbsolute(output)) {
    throw new Error(`${label} must be inside the payload root`);
  }
  return normalizePath(output.split(sep).join('/'), label);
}

function listPayloadFiles(root) {
  const rootStat = lstatSync(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error(`Payload root must be a real directory: ${root}`);
  const files = [];
  const unsafeEntries = [];

  const visit = directory => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = resolve(directory, entry.name);
      const path = relativeWithin(root, absolute, 'payload entry');
      const info = lstatSync(absolute);
      if (info.isSymbolicLink()) {
        unsafeEntries.push(path);
      } else if (info.isDirectory()) {
        visit(absolute);
      } else if (info.isFile()) {
        files.push(path);
      } else {
        unsafeEntries.push(path);
      }
    }
  };
  visit(root);
  return { files, unsafeEntries };
}

/**
 * Return all integrity findings without stopping at the first discrepancy.
 */
export function verifyReleaseManifest({ root, manifestPath, expectedVersion } = {}) {
  if (!root || !manifestPath) throw new Error('Both root and manifestPath are required');
  const payloadRoot = resolve(root);
  const sourceManifest = resolve(manifestPath);
  const manifestRelative = relativeWithin(payloadRoot, sourceManifest, 'Manifest');
  const raw = JSON.parse(readFileSync(sourceManifest, 'utf8'));
  const { entries, version } = parseManifest(raw);
  if (entries.has(manifestRelative)) fail(`manifest must not list itself: ${manifestRelative}`);

  const targetVersion = expectedVersion ?? version;
  if (!targetVersion) fail("supply --expected-version or declare a string 'version' or 'build'");
  const { files, unsafeEntries } = listPayloadFiles(payloadRoot);
  const diskFiles = new Set(files.filter(path => path !== manifestRelative));
  const declaredFiles = new Set(entries.keys());
  const missingOnDisk = [...declaredFiles].filter(path => !diskFiles.has(path)).sort();
  const missingFromManifest = [...diskFiles].filter(path => !declaredFiles.has(path)).sort();
  const hashMismatches = [];
  const byteMismatches = [];

  for (const [path, entry] of entries) {
    if (!diskFiles.has(path)) continue;
    const absolute = resolve(payloadRoot, path);
    const bytes = readFileSync(absolute);
    const actual = sha256Bytes(bytes);
    if (actual !== entry.sha256) hashMismatches.push({ path, expected: entry.sha256, actual });
    if (entry.bytes !== undefined && bytes.byteLength !== entry.bytes) {
      byteMismatches.push({ path, expected: entry.bytes, actual: bytes.byteLength });
    }
  }

  const alpha1Contamination = targetVersion?.includes('alpha.2')
    ? [...declaredFiles].filter(path => ALPHA1_ARCHIVE.test(path)).sort()
    : [];
  const versionMismatch = expectedVersion && version && expectedVersion !== version
    ? { expected: expectedVersion, actual: version }
    : null;
  const report = {
    root: payloadRoot,
    manifestPath: sourceManifest,
    version,
    expectedVersion: expectedVersion ?? null,
    checked: entries.size,
    onDisk: diskFiles.size,
    missingOnDisk,
    missingFromManifest,
    hashMismatches: hashMismatches.sort((a, b) => a.path.localeCompare(b.path)),
    byteMismatches: byteMismatches.sort((a, b) => a.path.localeCompare(b.path)),
    unsafeEntries: unsafeEntries.sort(),
    alpha1Contamination,
    versionMismatch,
  };
  report.ok = !report.missingOnDisk.length && !report.missingFromManifest.length && !report.hashMismatches.length
    && !report.byteMismatches.length && !report.unsafeEntries.length && !report.alpha1Contamination.length && !report.versionMismatch;
  return report;
}

function section(lines, title, items) {
  if (!items.length) return;
  lines.push(`${title} (${items.length}):`);
  for (const item of items) lines.push(`  - ${typeof item === 'string' ? item : item.path}`);
}

export function formatManifestReport(report) {
  const lines = [
    'Release manifest verification',
    `  manifest: ${report.manifestPath}`,
    `  payload root: ${report.root}`,
    `  version: ${report.version ?? 'not declared'}`,
    `  files: ${report.checked} declared, ${report.onDisk} on disk`,
  ];
  if (report.versionMismatch) lines.push(`VERSION MISMATCH: expected ${report.versionMismatch.expected}, found ${report.versionMismatch.actual}`);
  section(lines, 'MISSING ON DISK', report.missingOnDisk);
  section(lines, 'MISSING FROM MANIFEST', report.missingFromManifest);
  section(lines, 'HASH MISMATCH', report.hashMismatches);
  section(lines, 'BYTE COUNT MISMATCH', report.byteMismatches);
  section(lines, 'UNSAFE PAYLOAD ENTRY', report.unsafeEntries);
  section(lines, 'ALPHA1_ARCHIVE_IN_ALPHA2_MANIFEST', report.alpha1Contamination);
  lines.push(report.ok ? 'PASS: every payload file matches the manifest.' : 'FAIL: release manifest discrepancies found.');
  return lines.join('\n');
}

export function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === '--help' || flag === '-h') return { help: true };
    if (!['--root', '--manifest', '--expected-version'].includes(flag)) throw new Error(`Unknown option: ${flag}`);
    const value = argv[++index];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
    options[flag.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
  }
  return options;
}

function usage() {
  return 'Usage: node release/verify-release-manifest.mjs --root <extracted-payload> --manifest <manifest.json> [--expected-version <version>]';
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      console.log(usage());
      return;
    }
    const report = verifyReleaseManifest({
      root: options.root,
      manifestPath: options.manifest,
      expectedVersion: options.expectedVersion,
    });
    console.log(formatManifestReport(report));
    if (!report.ok) process.exitCode = 1;
  } catch (error) {
    console.error(`FAIL: ${error.message}`);
    console.error(usage());
    process.exitCode = 2;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
