#!/usr/bin/env bash
# Back-compat alias — audit listing is a sub-step of wiki-maintain
set -euo pipefail
exec "$(dirname "$0")/wiki-maintain.sh" --list-audits "$@"
