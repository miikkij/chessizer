#!/usr/bin/env bash
set -euo pipefail

# Use the same environment selection and Python version checks as pnpm wav:server.
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir/.."
exec node "$script_dir/../scripts/wav-server.mjs"
