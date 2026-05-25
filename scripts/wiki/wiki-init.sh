#!/usr/bin/env bash
# Initialize wiki/ (research three-class layout). Prefer scaffold-knowledge-meta.sh.
set -euo pipefail

WIKI_ROOT="${1:-${FLOW_WIKI_DIR:-${FLOW_ROOT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}/wiki}}"
export FLOW_WIKI_DIR="$WIKI_ROOT"

echo "Initializing research wiki at: $WIKI_ROOT"
"$(dirname "$0")/scaffold-knowledge-meta.sh"
"$(dirname "$0")/purge-legacy-knowledge.sh" 2>/dev/null || true
echo "Done."
