# CML Local Alpha 0.1.0-alpha.2

Documentation-and-packaging correction only; app/receipt version stays 0.1.0.
Start with [README.md](../README.md) or [TESTER_README.md](../TESTER_README.md).
[WHY_CML.md](../WHY_CML.md) records project history and evidence boundaries.

Tester docs now use generic extraction/Windows + WSL startup instructions,
local storage ~/.local/share/cml-local-alpha/ and CML_ALPHA_DATA_DIR, and accurate
receipt guidance. No compiler, provenance, validator, server, store, UI,
persistence, test, fixture, receipt verifier, or installer logic has changed.
Alpha.1's archive, checksum, manifest, tag, and evidence are preserved exactly.

A PASS means static acceptance by CML Reference Compiler 1.2.0-alpha.0 only. It does not establish runtime execution, rendering, timing verification, safety certification, human-behavior proof, deployment, or launch authority.

Receipts are unsigned reproducibility records and may contain complete current and last-accepted source. Sanitize personal, proprietary, and research content before public sharing. Offline verification checks internal consistency with the bundled compiler, not authorship, time, custody, or external execution. Editing a receipt breaks its digest; use sample-only receipts for reproducible reports, or share a clearly labeled sanitized excerpt rather than claiming it is the original verified receipt.

Provenance limitation: the compiler snapshot is 1.2.0-alpha.0 with 15 recorded
file hashes; no upstream compiler commit ID is recorded or invented. Historical
paths in immutable provenance and installer defaults are retained, not setup
instructions. The installer detects the extracted project when used as documented.
Fixture JSON and synthetic example receipts retain their original version labels.
Vendored licenses/notices remain unchanged; no product-wide license decision is
made. See WHY_CML.md for the unresolved product-license boundary.

Existing tests, fixture checks, all 15 provenance hashes, inventory/hash checks,
deterministic rebuilding, and tests from fresh extraction are required. Separate
local alpha.2 verification records contain actual outcomes. Live Windows shortcut,
browser, and WSL forwarding checks require manual confirmation; automated UI tests
are simulated. Archive inventory explicitly excludes saved documents, credentials,
private research, historical staging directories, and preparation logs.

Build locally using existing Python 3: `python3 release/build-alpha2.py`.
No Git push, tag, publication, or release creation is part of this preparation.
