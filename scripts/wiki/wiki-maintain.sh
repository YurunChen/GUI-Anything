#!/usr/bin/env bash
# Wiki knowledge maintenance — /llm-wiki Phase 2 (report, list audits, agent)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

exec bun run scripts/wiki/llm-wiki/maintain.ts "$@"
