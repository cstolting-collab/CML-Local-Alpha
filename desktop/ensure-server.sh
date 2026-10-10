#!/usr/bin/env bash
set -euo pipefail
project=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
if ! command -v node >/dev/null 2>&1; then
  export NVM_DIR="$HOME/.nvm"
  if [[ -s "$NVM_DIR/nvm.sh" ]]; then
    source "$NVM_DIR/nvm.sh"
  fi
fi
command -v node >/dev/null || { echo 'Existing Node.js installation was not found.' >&2; exit 1; }
command -v flock >/dev/null || { echo 'Existing flock command was not found.' >&2; exit 1; }
runtime="/tmp/cml-local-alpha-launch-$UID"
mkdir -p -- "$runtime"
chmod 700 "$runtime"
# The lock covers checking, starting, and waiting. Detached Node does not inherit it.
exec flock -w 60 "$runtime/start.lock" node "$project/desktop/ensure-server.mjs" "$runtime"
