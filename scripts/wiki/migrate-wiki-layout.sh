#!/usr/bin/env bash
# Move legacy wiki/ subdirs into knowledge/, sessions/, notes/
# errors/snippets/decisions/ are dropped (not moved); use purge-legacy-knowledge.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
WIKI="${FLOW_WIKI_DIR:-$ROOT_DIR/wiki}"

mkdir -p "$WIKI/knowledge" "$WIKI/sessions" "$WIKI/notes"

move_dir() {
  local src="$1"
  local dest_parent="$2"
  if [[ ! -d "$src" ]]; then
    return 0
  fi
  echo "[migrate] $src -> $dest_parent/"
  shopt -s nullglob
  for item in "$src"/*; do
    local base
    base="$(basename "$item")"
    if [[ -e "$dest_parent/$base" ]]; then
      echo "  skip (exists): $base"
      continue
    fi
    mv "$item" "$dest_parent/"
  done
  rmdir "$src" 2>/dev/null || true
}

# knowledge-base/* -> knowledge/
if [[ -d "$WIKI/knowledge-base" ]]; then
  for sub in errors snippets decisions; do
    [[ -d "$WIKI/knowledge-base/$sub" ]] && rm -rf "$WIKI/knowledge-base/$sub"
  done
  for sub in contexts entities summaries; do
    if [[ -d "$WIKI/knowledge-base/$sub" ]]; then
      mkdir -p "$WIKI/knowledge/$sub"
      move_dir "$WIKI/knowledge-base/$sub" "$WIKI/knowledge/$sub"
    fi
  done
  rmdir "$WIKI/knowledge-base" 2>/dev/null || true
fi

# runtime/*.json -> sessions/
if [[ -d "$WIKI/runtime" ]]; then
  shopt -s nullglob
  for f in "$WIKI/runtime"/*.json; do
    base="$(basename "$f")"
    if [[ -e "$WIKI/sessions/$base" ]]; then
      echo "[migrate] skip $base"
      continue
    fi
    echo "[migrate] runtime/$base -> sessions/"
    mv "$f" "$WIKI/sessions/$base"
  done
  rmdir "$WIKI/runtime" 2>/dev/null || true
fi

# evidence/{id}.json -> sessions/{id}-evidence.json
if [[ -d "$WIKI/evidence" ]]; then
  shopt -s nullglob
  for f in "$WIKI/evidence"/*.json; do
    sid="$(basename "$f" .json)"
    dest="$WIKI/sessions/${sid}-evidence.json"
    if [[ -e "$dest" ]]; then
      echo "[migrate] skip evidence $sid"
      continue
    fi
    echo "[migrate] evidence/$sid.json -> sessions/${sid}-evidence.json"
    mv "$f" "$dest"
  done
  rmdir "$WIKI/evidence" 2>/dev/null || true
fi

# daily-notes -> notes
move_dir "$WIKI/daily-notes" "$WIKI/notes"

# Research three-class entry tree
for sub in contexts entities summaries; do
  mkdir -p "$WIKI/knowledge/$sub"
done
mkdir -p "$WIKI/knowledge/outputs/progress" "$WIKI/knowledge/outputs/queries"

echo "[migrate] Done. Layout:"
ls -la "$WIKI"
