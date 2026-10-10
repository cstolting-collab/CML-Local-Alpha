# CML Local Alpha — Continuity Validator

A dependency-free local app for creating and checking CML continuity documents. Requires Node.js 18.19 or newer. No installation, cloud, account, credentials, analytics, publishing, or external requests.

Start with this exact command:

```bash
node /tmp/cml-local-alpha/server.js
```

Open **http://127.0.0.1:4180**. Stop with Ctrl+C.

1. Use the starter, create a new document, or load a UTF-8 `.cml` file.
2. Edit the name and source. Edits save after a short pause; **Save now** confirms persistence. Wait for “Saved locally” before closing.
3. Choose **Validate document**. Inspect error codes and jump to reported source lines. Accepted canonical plans and normalized IR are visible separately.
4. **Export verification receipt** downloads a JSON receipt for the current checked revision, whether PASS or FAIL. You can also download the `.cml` source.

Documents persist in `~/.local/share/cml-local-alpha/` across browser and server restarts. Each document has its own atomic JSON file. Accepted state survives a failed edit. Revisions prevent another window from silently overwriting changes; reload the document if a conflict occurs. The last 20 checks are retained. Maximum source size is 256 KiB. Back up the data directory to keep a separate copy. Optional `CML_ALPHA_DATA_DIR` selects another local data directory.

The app folder is currently in `/tmp` because this session cannot write to a new permanent workspace directory. `/tmp` may be cleared. Move or copy this entire app folder to a permanent product directory before relying on it long term; it has no dependency on EXP014 or the reference checkout. The default document storage is outside `/tmp`.

The unchanged compiler snapshot comes from `/home/cherie/projects/CML-Reference-Compiler` (`1.2.0-alpha.0`). Its existing local workbench informed the validation/inspection/export workflow. `evidence/COMPILER_PROVENANCE.json` records exact reused files and hashes; upstream notices are under `vendor/compiler/`. No robotics telemetry, launch control, or benchmark components are included.

A PASS means the compiler accepted the document’s static rules. It does not prove renderer behavior, runtime continuity, timing, physical execution, or authority. Receipts contain exact source, SHA-256 digests, diagnostics, normalized state, and compiler provenance. They are unsigned local records. To recompute a downloaded receipt, run `node /tmp/cml-local-alpha/verify-receipt.js /path/to/receipt.json`.

Run functional tests with `node /tmp/cml-local-alpha/tests/run.js`. Tests exercise the real compiler, persistence across store restarts, accepted-state preservation, exported receipts, concurrent edits, the browser workflow model, the actual UI module against a DOM fixture, and HTTP handlers in memory. They do not require network access. Browser rendering and live loopback serving are separate manual checks in this restricted environment; see `evidence/VALIDATION.json` for the actual results.
