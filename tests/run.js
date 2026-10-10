import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
for (const name of ['functional.test.js', 'browser-workflow.test.js']) {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL(name, import.meta.url))], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
