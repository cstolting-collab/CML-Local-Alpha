# Reproducible 10-minute test — 0.1.0-alpha.2

Prerequisite: README setup complete, archive hash checked, sample-only data, and
shortcut installed. Assign yourself T01–T05. Record actual results and elapsed
time; use BLOCKED instead of PASS for any step you cannot run. Setup time is
outside the ten minutes. Run from the extracted project root in WSL.

| Time | Action | Expected result |
| --- | --- | --- |
| 0:00–1:00 | Run `node tester/check-fixtures.mjs`. Double-click **CML Local Alpha**. | Fixture check passes; browser reaches `http://127.0.0.1:4180`. |
| 1:00–2:00 | Click the shortcut twice more. Run `pgrep -af 'node.*server.js'` in WSL; count only this project's absolute `server.js` path. | All tabs show the app; exactly one server for the project; no address-in-use error. |
| 2:00–3:00 | **Load a .cml file** → `tester/sample-valid.cml` (browse its WSL UNC path). Rename to `T0N-alpha2-smoke`; **Save now**, wait for **Saved locally**. Click **Validate document**. | PASS; zero issues; accepted plan and normalized IR available. |
| 3:00–4:00 | Expand plan/IR. Export verification receipt. In WSL run `node verify-receipt.js /mnt/c/Users/YOUR_WINDOWS_USER/Downloads/RECEIPT.json` with the actual downloaded filename. | `verified: true`, `verdict: PASS`; plan describes static instructions only. |
| 4:00–5:00 | In editor delete exactly line 3, `  □L target=world`, including its newline. **Save now**, wait for saved, then validate. | FAIL; `CML-E109`: `Block 'my_scene' requires LOCK target=world.` at line 1, column 1. Prior accepted plan/IR remain available. |
| 5:00–6:00 | Export the FAIL receipt, verify it with the command above. | `verified: true`, `verdict: FAIL`; receipt's current source lacks world lock; `lastAccepted.source` still has it. |
| 6:00–7:00 | Reload browser; select your named document. | Invalid draft persists, current result remains FAIL, prior accepted state is preserved. |
| 7:00–8:00 | Restore `  □L target=world` as line 3; save and validate. Download `.cml` source. | PASS again; downloaded source includes both required locks. |
| 8:00–9:00 | After **Saved locally**, close app tabs. Identify the one project server PID as above and `kill PID`; click shortcut again; select your document. | Server restarts; saved source and accepted state survive. If another app owns 4180, report BLOCKED without killing it. |
| 9:00–10:00 | Complete feedback, attach only sample-data receipts if useful. | Record each step, environment, startup delays, and any confusing scope wording. |

A PASS means static acceptance by CML Reference Compiler 1.2.0-alpha.0 only. It does not establish runtime execution, rendering, timing verification, safety certification, human-behavior proof, deployment, or launch authority.

Receipts are unsigned reproducibility records and may contain complete current and last-accepted source. Sanitize personal, proprietary, and research content before public sharing. Offline verification checks internal consistency with the bundled compiler, not authorship, time, custody, or external execution. Editing a receipt breaks its digest; use sample-only receipts for reproducible reports, or share a clearly labeled sanitized excerpt rather than claiming it is the original verified receipt.

See [WHY_CML.md](../WHY_CML.md). Avoid simultaneous draft edits during this
script; revision conflicts are reported rather than silently overwriting another window.
