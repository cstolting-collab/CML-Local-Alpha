# CML Local Alpha 0.1 — five-tester engineering prerelease

Build: `0.1.0-alpha.1` (2026-10-10); app/receipt version remains `0.1.0`.
For testers T01–T05. Prepared for private distribution; not published or pushed.

**Local-only static CML validation. PASS is compiler acceptance of static rules,
not runtime execution, rendering, timing verification, physical execution, or
launch authority.** Plans, IR, and unsigned receipts are inspection artifacts.
No account, cloud service, telemetry, or package installation is required.

## Requirements and first start

Use an existing Windows 10/11 computer with WSL 2, an Ubuntu distribution,
a non-root default WSL user, Windows PowerShell 5.1, and a modern browser.
Existing WSL Node.js >=18.19, bash, flock, and tar are required; nvm installations
are supported. Windows must support WSL interoperability and localhost forwarding.
Port 4180 must be available or already serving this exact app. No dependencies
are installed by this package. If a prerequisite is missing, report BLOCKED.

Verify the archive with Windows PowerShell `Get-FileHash .\cml-local-alpha-0.1.0-alpha.1.tar.gz -Algorithm SHA256`
against the adjacent `.sha256` file before extraction. In WSL, extract into a
permanent directory under your Linux home (replace the archive path):

```bash
mkdir -p "$HOME/cml-tester"
tar -xzf /mnt/c/Users/YOUR_WINDOWS_USER/Downloads/cml-local-alpha-0.1.0-alpha.1.tar.gz -C "$HOME/cml-tester"
cd "$HOME/cml-tester/cml-local-alpha-0.1.0-alpha.1"
node --version
command -v bash flock tar
explorer.exe "$(wslpath -w "$PWD/desktop")"
```

In that Explorer folder, right-click `Install-CML-Local-Alpha.ps1` and choose
**Run with PowerShell**. It creates/updates **CML Local Alpha** on your Windows
Desktop using this extracted path, WSL distribution, and default Linux user.
Alternative: in Windows PowerShell run
`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "FULL_WSL_UNC_PATH\desktop\Install-CML-Local-Alpha.ps1"`.
For the original project, that full path is
`\wsl.localhost\Ubuntu\home\cherie\cml-private-research\products\CML_LOCAL_ALPHA_20261010`.

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
Do not terminate unrelated Node processes. Receipts include complete source;
share only test fixtures and sanitized diagnostics in feedback.

## Verification limits

All 20 existing tests and fixture checks pass in the preparation environment;
compiler provenance is checked by the suite. Live socket access is blocked here
by EPERM, and Windows interop fails with `UtilBindVsockAnyPort`. Shortcut install,
Windows browser access, live duplicate-click behavior, and rendering therefore
require tester confirmation. Automated persistence/UI tests are not a substitute
for those Windows checks. Vendored compiler notices/licenses are retained.
