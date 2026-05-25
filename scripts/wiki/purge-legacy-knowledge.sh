#!/usr/bin/env bash
# Remove legacy errors/snippets/decisions/ dirs and E/S/D-prefixed entry files.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
export FLOW_WIKI_DIR="${FLOW_WIKI_DIR:-$ROOT/wiki}"

cd "$ROOT/scheme"
exec bun -e "
import { purgeLegacyKnowledgeLayout } from '../src/data/wiki/wiki-data-layout.ts';
purgeLegacyKnowledgeLayout();
console.log('Purged legacy knowledge layout under', process.env.FLOW_WIKI_DIR);
"
