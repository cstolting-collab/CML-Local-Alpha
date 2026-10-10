# CML Local Alpha 0.1 — Continuity Validator

A dependency-free local app for creating and checking CML continuity documents.
**Local-only static validation: no runtime execution, rendering, timing
verification, physical execution, or launch authority.** A PASS means the
compiler accepted the document's static rules. Plans, IR, and unsigned receipts
are inspection artifacts. No cloud, account, telemetry, or package installation
is required.

For the project history, evidence boundaries, and long-term research direction, read [CML: Historical Context and Research Direction](WHY_CML.md).\n\nRequires Node.js 18.19 or newer.

## Windows + WSL Start

Use an existing Windows 10/11 system with WSL 2, an Ubuntu distribution, a non-root default WSL user, Windows PowerShell 5.1, and a modern browser. WSL must have Node.js ≥ 18.19, bash, flock, and tar available (nvm installations are supported). WSL interoperability and localhost forwarding must work. Port 4180 must be free or already serving this application.

Complete tester-oriented instructions are in [TESTER_README.md](TESTER_README.md).

### Verify and extract

Verify the prerelease archive against its adjacent `.sha256` file:

```powershell
Get-FileHash .\cml-local-alpha-0.1.0-alpha.1.tar.gz -Algorithm SHA256
```

In WSL, replace `YOUR_WINDOWS_USER` and the archive path with your own:

```bash
mkdir -p "$HOME/cml-tester"
tar -xzf /mnt/c/Users/YOUR_WINDOWS_USER/Downloads/cml-local-alpha-0.1.0-alpha.1.tar.gz -C "$HOME/cml-tester"
cd "$HOME/cml-tester/cml-local-alpha-0.1.0-alpha.1"
node --version
command -v bash flock tar
explorer.exe "$(wslpath -w "$PWD/desktop")"
```

In that Explorer folder, right-click `Install-CML-Local-Alpha.ps1` and choose
**Run with PowerShell**. The installer creates or updates the Windows desktop
shortcut **CML Local Alpha** using your extracted project path, WSL distribution,
and default Linux user. Keep the extracted project in this permanent directory.
If you extracted elsewhere, use that directory in the `cd` command instead.

Double-click **CML Local Alpha**. It checks for an existing server, starts one
if needed, waits until ready, checks Windows access, and opens
**http://127.0.0.1:4180**. Repeated clicks reuse the server; startup is serialized.
The server binds only to `127.0.0.1`. Startup errors remain visible in the window.

Fallback, from your extracted project directory in WSL:

```bash
bash desktop/ensure-server.sh
```

Then open the same URL manually. The server stays running after the launcher
closes. To stop it, run `pgrep -af 'node.*server.js'`, identify the PID whose
full project path matches your extraction, and run `kill PID`. For a foreground
start, run `node server.js` from the project directory and stop with Ctrl+C.

## Use and persistence

1. Use the starter, create a new document, or load a UTF-8 `.cml` file.
2. Edit the name and source. Edits save after a short pause; **Save now** confirms persistence. Wait for “Saved locally” before closing.
3. Choose **Validate document**. Inspect error codes and jump to reported source lines. Accepted canonical plans and normalized IR are visible separately.
4. **Export verification receipt** downloads a JSON receipt for the current checked revision, whether PASS or FAIL. You can also download the `.cml` source.

Documents persist in WSL `~/.local/share/cml-local-alpha/` across browser and
server restarts. Optional `CML_ALPHA_DATA_DIR` selects another local directory.
Back up this directory before testing an existing installation; retain it when
replacing the app. Each document has an atomic JSON file. Accepted state survives
a failed edit. Revisions prevent another window from silently overwriting
changes; reload the document if a conflict occurs. The last 20 checks are
retained. Maximum source size is 256 KiB.

The unchanged compiler snapshot is CML Reference Compiler `1.2.0-alpha.0`.
`evidence/COMPILER_PROVENANCE.json` records reused files and hashes; licenses
and notices are under `vendor/compiler/`. No robotics telemetry, launch control,
or benchmark components are included.

Receipts contain exact source, SHA-256 digests, diagnostics, normalized state,
and compiler provenance. They are unsigned local records. From your extracted
project directory, replace the receipt path with your downloaded file:

```bash
node verify-receipt.js /mnt/c/Users/YOUR_WINDOWS_USER/Downloads/RECEIPT.json
```

## Verification and feedback

From the extracted project directory, run the existing tests:

```bash
node tests/run.js
```

Tests exercise the compiler, persistence, accepted-state preservation, receipts,
concurrent edits, simulated browser workflows, and HTTP handlers in memory.
They do not require network access. These tests do not verify Windows shortcut
installation, live loopback serving, or browser rendering; those require manual
checks on the tester's machine.

Follow the [10-minute test script](tester/TEST_SCRIPT_10_MIN.md) and record
results in the [feedback template](tester/FEEDBACK_TEMPLATE.md). Use only sample
data in shared receipts, since receipts include complete source.
