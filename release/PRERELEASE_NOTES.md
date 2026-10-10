# CML Local Alpha 0.1.0-alpha.1 — private engineering test build

Audience: five external engineering testers, T01–T05. No publication or push
has occurred. Start with TESTER_README.md; README.md is retained historical
project documentation and contains obsolete /tmp setup paths.

The app remains version 0.1.0; this archive's distribution version is
0.1.0-alpha.1. Compiler 1.2.0-alpha.0 and its recorded provenance are unchanged.
Scope: local-only static validation, never runtime execution, rendering, timing
verification, or launch authority. The server binds only to 127.0.0.1:4180.

Prepared assets: concise tester README, timed manual test, valid/invalid UTF-8
fixtures, exact expected CML-E109 result, isolated fixture checker, feedback
form, and portable Windows/WSL shortcut installer. Startup locking/readiness
logic is retained; installer now detects testers' WSL user/distribution/path.

Verification: 20/20 existing tests pass, including compiler file hashes,
document persistence, accepted-state preservation, receipts, local request
policy, and simulated UI. The isolated fixture checker passes PASS/FAIL receipt
recomputation and store reload. Shell/Node syntax checks pass. The archive is
built from an explicit file list, SHA-256 checked, extracted, and tested again.

Blocked: Windows PowerShell cannot execute in this environment because WSL
UtilBindVsockAnyPort fails; live loopback access returns EPERM. Windows shortcut
installation, browser opening/rendering, and live startup/reuse require testers.
No operational performance or timing claims are made. Receipt/source hashes
vary with edits and line endings; fixtures' expected JSON uses exact UTF-8 bytes.

The package includes vendored Apache-2.0 software license and notices; it does
not assign a new license to the product. Saved documents, private research,
credentials, environment files, runtime logs, hidden workspace directories,
and neighboring projects are excluded. Only synthetic example receipts ship.

GitHub-ready release assets: cml-local-alpha-0.1.0-alpha.1.tar.gz, its .sha256,
and cml-local-alpha-0.1.0-alpha.1.files.json (exact archive inventory and per-file
SHA-256). GitHub-ready source paths are those in the inventory, plus that
inventory and checksum if desired. These are prepared locally, not uploaded.
To reproduce locally with existing Python 3: python3 release/build-prerelease.py.
