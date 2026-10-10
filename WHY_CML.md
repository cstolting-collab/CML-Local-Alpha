# Why CML Local Alpha: project history and evidence boundaries

CML Local Alpha narrows the existing CML workbench's validate/inspect/export
pattern to local continuity documents. It reuses an unchanged dependency closure
of CML Reference Compiler 1.2.0-alpha.0 and its canonical exporter. The local
store and focused UI are product-specific. These statements are grounded in
`evidence/COMPILER_PROVENANCE.json` and the supplied application, not a claim of
validated runtime or behavioral outcomes.

## Evidence boundary

A PASS means static acceptance by CML Reference Compiler 1.2.0-alpha.0 only. It does not establish runtime execution, rendering, timing verification, safety certification, human-behavior proof, deployment, or launch authority.

A canonical plan or normalized IR describes compiler output; it does not render
or execute a scene. Durations and reactions written in CML are source parameters,
not measured timing or evidence about people. The application has no operational
deployment or launch authorization function.

## Snapshot provenance and historical records

The recorded snapshot identifies compiler version 1.2.0-alpha.0 and SHA-256
hashes for 15 compiler/exporter/license/notice files. Hash checks establish byte
identity with that recorded file set, not an independently authenticated upstream
history. No upstream compiler commit ID is recorded in this provenance file;
none is inferred or invented here. A package version is not a commit identifier.
Its historical machine paths are retained unchanged as provenance, not setup
instructions or prerequisites. Use your own extracted project directory.

The alpha.1 archive, checksum, manifest, tag, and preparation evidence remain
historical records. Alpha.2 corrects documentation and packaging only. Historical
fixtures/receipts retain original version labels, timestamps, and data. App and
receipt version remain 0.1.0. Historical evidence does not certify today's Windows
startup, rendering, or any operational behavior. Current verification records
identify which checks actually ran.

## Receipts and sharing

Receipts are unsigned reproducibility records and may contain complete current and last-accepted source. Sanitize personal, proprietary, and research content before public sharing. Offline verification checks internal consistency with the bundled compiler, not authorship, time, custody, or external execution. Editing a receipt breaks its digest; use sample-only receipts for reproducible reports, or share a clearly labeled sanitized excerpt rather than claiming it is the original verified receipt.

Recompute a sample receipt offline from the extracted project directory with
`node verify-receipt.js RECEIPT.json`, using your actual path. SHA-256 detects
changes relative to a recorded digest; it is not a signature or custody proof.

## Licensing limitation

The vendored compiler includes its Apache-2.0 LICENSE, NOTICE, and split-license
policy in `vendor/compiler/`. Those records are preserved without modification.
The supplied product files do not establish a separate product-wide license grant;
this correction makes no new license decision and does not extend the compiler's
license to every product document or asset. Broader redistribution rights remain
unresolved where no applicable grant is recorded. No endorsement is implied.

See [README.md](README.md) for startup and [TESTER_README.md](TESTER_README.md)
for the reproducible tester workflow. Storage remains local at
`~/.local/share/cml-local-alpha/` or the existing `CML_ALPHA_DATA_DIR` override.
