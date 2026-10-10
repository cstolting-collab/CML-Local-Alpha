import http from 'node:http';
import { readFileSync, openSync, closeSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const project = fileURLToPath(new URL('../', import.meta.url));
const expected = readFileSync(join(project, 'public/index.html'), 'utf8');
const log = join(process.argv[2], 'server.log');
function probe() {
  return new Promise((resolve, reject) => {
    const request = http.get('http://127.0.0.1:4180/', { agent: false }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; if (body.length > 1000000) response.destroy(); });
      response.on('error', reject);
      response.on('end', () => resolve(response.statusCode === 200 && body === expected ? 'ready' : 'occupied'));
    });
    request.setTimeout(1500, () => request.destroy(new Error('Local server readiness check timed out.')));
    request.on('error', error => error.code === 'ECONNREFUSED' ? resolve('absent') : reject(error));
  });
}
try {
  const initial = await probe();
  if (initial === 'occupied') throw new Error('Port 4180 is occupied by a different app. No server was started.');
  if (initial === 'ready') {
    console.log('Reusing CML Local Alpha: http://127.0.0.1:4180');
  } else {
    const output = openSync(log, 'a', 0o600);
    const child = spawn(process.execPath, [join(project, 'server.js')], {
      cwd: project, detached: true, stdio: ['ignore', output, output],
      env: process.env,
    });
    closeSync(output);
    let failure;
    child.on('error', error => { failure = error; });
    child.unref();
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (failure) throw failure;
      const state = await probe();
      if (state === 'ready') { ready = true; break; }
      if (state === 'occupied') throw new Error('Port 4180 is occupied by a different app.');
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    if (!ready) throw new Error(`Server did not become ready. Inspect ${log}`);
    console.log('CML Local Alpha ready: http://127.0.0.1:4180');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
