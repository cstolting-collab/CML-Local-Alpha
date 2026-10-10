# CML Local Alpha 0.1 — five-tester engineering prerelease

Build: `0.1.0-alpha.2` (2026-10-10); app/receipt version remains `0.1.0`.
For testers T01–T05. Documentation-and-packaging correction; app/receipt version remains unchanged.

**Local-only static validation.** A PASS means static acceptance by CML Reference Compiler 1.2.0-alpha.0 only. It does not establish runtime execution, rendering, timing verification, safety certification, human-behavior proof, deployment, or launch authority.

See [WHY_CML.md](WHY_CML.md) for project history and evidence boundaries.
No account, cloud service, telemetry, or package installation is required.

## Requirements and first start

Use an existing Windows 10/11 computer with WSL 2, an Ubuntu distribution,
a non-root default WSL user, Windows PowerShell 5.1, and a modern browser.
Existing WSL Node.js >=18.19, bash, flock, and tar are required; nvm installations
are supported. Windows must support WSL interoperability and localhost forwarding.
Port 4180 must be available or already serving this exact app. No dependencies
are installed by this package. If a prerequisite is missing, report BLOCKED.

Verify the archive with Windows PowerShell `Get-FileHash .\cml-local-alpha-0.1.0-alpha.2.tar.gz -Algorithm SHA256`
against the adjacent `.sha256` file before extraction. In WSL, extract into a
permanent directory under your Linux home (replace the archive path):

```bash
mkdir -p "$HOME/cml-tester"
tar -xzf /mnt/c/Users/YOUR_WINDOWS_USER/Downloads/cml-local-alpha-0.1.0-alpha.2.tar.gz -C "$HOME/cml-tester"
cd "$HOME/cml-tester/cml-local-alpha-0.1.0-alpha.2"
node --version
command -v bash flock tar
explorer.exe "$(wslpath -w "$PWD/desktop")"
```

In that Explorer folder, right-click `Install-CML-Local-Alpha.ps1` and choose
**Run with PowerShell**. It creates/updates **CML Local Alpha** on your Windows
Desktop using this extracted path, WSL distribution, and default Linux user.
Alternative: in Windows PowerShell run
`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "FULL_WSL_UNC_PATH\desktop\Install-CML-Local-Alpha.ps1"`.
Double-click **CML Local Alpha** → WSL `desktop/ensure-server.sh` → readiness
check/start or reuse → Windows readiness check → browser at
**http://127.0.0.1:4180**. Startup is serialized; repeated clicks reuse the server.
Errors remain visible in the launch window. Fallback: run
`bash desktop/ensure-server.sh` in WSL, then open the same URL manually.

## Test and storage

Follow [the 10-minute script](tester/TEST_SCRIPT_10_MIN.md), using only supplied
sample data. Record results in [the feedback template](tester/FEEDBACK_TEMPLATE.md).
Use [sample-valid.cml](tester/sample-valid.cml); the invalid fixture and its exact
expected diagnostic are beside it. `node tester/check-fixtures.mjs` checks both
fixtures without opening a socket or touching your saved documents.

Documents stay in WSL `~/.local/share/cml-local-alpha/`, unless the existing
`CML_ALPHA_DATA_DIR` override is set. Back up this directory before testing an
existing installation. Do not delete it when replacing the app. The same WSL
user/data path preserves documents; a different user or override changes the store.
The server remains running after the launcher closes. To stop it, find the PID
with `pgrep -af 'node.*server.js'`, confirm its full project path, then `kill PID`.
Do not terminate unrelated Node processes.

## Receipt guidance

Receipts are unsigned reproducibility records and may contain complete current and last-accepted source. Sanitize personal, proprietary, and research content before public sharing. Offline verification checks internal consistency with the bundled compiler, not authorship, time, custody, or external execution. Editing a receipt breaks its digest; use sample-only receipts for reproducible reports, or share a clearly labeled sanitized excerpt rather than claiming it is the original verified receipt.

From the extracted project root, run
`node verify-receipt.js /mnt/c/Users/YOUR_WINDOWS_USER/Downloads/RECEIPT.json`
with your actual receipt filename.

## Verification limits

Existing tests cover static compiler behavior, persistence, and simulated UI/API
workflows. Run `node tests/run.js` and `node tester/check-fixtures.mjs` from
the extracted project directory. These do not verify Windows shortcut installation,
localhost forwarding, browser rendering, or live repeated-click startup; confirm
those on your own machine. The fixture metadata retains its original alpha.1
build label as an unchanged historical fixture, not this distribution's version.
See [alpha.2 release notes](release/PRERELEASE_NOTES-alpha.2.md) for verification
and unresolved provenance/license limitations. Vendored licenses/notices remain.
