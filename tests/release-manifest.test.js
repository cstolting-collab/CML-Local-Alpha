import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { formatManifestReport, parseArgs, parseManifest, verifyReleaseManifest } from '../release/verify-release-manifest.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');

async function fixture(t, entries) {
  const root = await mkdtemp(join(tmpdir(), 'cml-release-manifest-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const [path, value] of Object.entries(entries)) {
    const file = join(root, path);
    await mkdir(join(file, '..'), { recursive: true });
    await writeFile(file, value);
  }
  const manifestPath = join(root, 'release', 'RELEASE-MANIFEST.json');
  await mkdir(join(root, 'release'), { recursive: true });
  return { root, manifestPath };
}

async function writeManifest(path, manifest) {
  await writeFile(path, JSON.stringify(manifest, null, 2));
}

test('accepts the array manifest layout and recomputes every listed SHA-256', async t => {
  const { root, manifestPath } = await fixture(t, { 'README.md': 'read me', 'nested/value.txt': 'value' });
  await writeManifest(manifestPath, { build: '0.1.0-alpha.2', files: [
    { path: 'README.md', sha256: digest('read me'), bytes: 7 },
    { path: 'nested/value.txt', sha256: digest('value'), bytes: 5 },
  ] });
  const report = verifyReleaseManifest({ root, manifestPath, expectedVersion: '0.1.0-alpha.2' });
  assert.equal(report.ok, true);
  assert.equal(report.checked, 2);
  assert.equal(report.onDisk, 2);
});

test('accepts the object-map manifest layout', async t => {
  const { root, manifestPath } = await fixture(t, { 'README.md': 'object manifest' });
  await writeManifest(manifestPath, { version: '0.1.0-alpha.2', files: { 'README.md': digest('object manifest') } });
  const report = verifyReleaseManifest({ root, manifestPath });
  assert.equal(report.ok, true);
  assert.equal(report.checked, 1);
});

test('CLI argument parser maps the manifest and payload-root options', () => {
  assert.deepEqual(parseArgs(['--root', '/payload', '--manifest', '/payload/release/RELEASE-MANIFEST.json', '--expected-version', '0.1.0-alpha.2']), {
    root: '/payload',
    manifest: '/payload/release/RELEASE-MANIFEST.json',
    expectedVersion: '0.1.0-alpha.2',
  });
});

test('reports a recomputed SHA-256 mismatch', async t => {
  const { root, manifestPath } = await fixture(t, { 'README.md': 'changed on disk' });
  await writeManifest(manifestPath, { version: '0.1.0-alpha.2', files: { 'README.md': digest('original') } });
  const report = verifyReleaseManifest({ root, manifestPath });
  assert.equal(report.ok, false);
  assert.deepEqual(report.hashMismatches.map(item => item.path), ['README.md']);
  assert.match(formatManifestReport(report), /HASH MISMATCH \(1\):\n  - README\.md/);
});

test('reports manifest-listed missing files and on-disk unmanifested files together', async t => {
  const { root, manifestPath } = await fixture(t, { 'README.md': 'listed', 'unexpected.txt': 'not listed' });
  await writeManifest(manifestPath, { version: '0.1.0-alpha.2', files: {
    'README.md': digest('listed'),
    'missing.txt': digest('not on disk'),
  } });
  const report = verifyReleaseManifest({ root, manifestPath });
  assert.deepEqual(report.missingOnDisk, ['missing.txt']);
  assert.deepEqual(report.missingFromManifest, ['unexpected.txt']);
  const text = formatManifestReport(report);
  assert.match(text, /MISSING ON DISK \(1\):\n  - missing\.txt/);
  assert.match(text, /MISSING FROM MANIFEST \(1\):\n  - unexpected\.txt/);
});

test('rejects an Alpha.1 archive declared by an Alpha.2 manifest', async t => {
  const oldArchive = 'release/cml-local-alpha-0.1.0-alpha.1.tar.gz';
  const { root, manifestPath } = await fixture(t, { [oldArchive]: 'old archive' });
  await writeManifest(manifestPath, { version: '0.1.0-alpha.2', files: { [oldArchive]: digest('old archive') } });
  const report = verifyReleaseManifest({ root, manifestPath });
  assert.deepEqual(report.alpha1Contamination, [oldArchive]);
  assert.equal(report.ok, false);
  assert.match(formatManifestReport(report), /ALPHA1_ARCHIVE_IN_ALPHA2_MANIFEST \(1\)/);
});

test('rejects malformed paths, digests, and duplicate normalized entries', () => {
  assert.throws(() => parseManifest({ files: { '../escape': digest('x') } }), /must not contain/);
  assert.throws(() => parseManifest({ files: { 'README.md': 'ABC' } }), /lowercase SHA-256/);
  assert.throws(() => parseManifest({ files: [
    { path: 'README.md', sha256: digest('a') },
    { path: 'README.md', sha256: digest('b') },
  ] }), /duplicate path/);
});

test('requires an explicit or declared release version before evaluating release-specific rules', async t => {
  const { root, manifestPath } = await fixture(t, { 'README.md': 'no version' });
  await writeManifest(manifestPath, { files: { 'README.md': digest('no version') } });
  assert.throws(() => verifyReleaseManifest({ root, manifestPath }), /supply --expected-version/);
});
