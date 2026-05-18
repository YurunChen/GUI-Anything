#!/usr/bin/env bash
# Wiki 搜索工具
# 快速基于 grep 的 wiki 搜索

set -euo pipefail

WIKI_ROOT="${WIKI_ROOT:-${FLOW_ROOT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}/wiki}"

usage() {
  cat << EOF
Usage: $(basename "$0") [OPTIONS] QUERY

Wiki 搜索工具 - 快速检索个人知识库

Options:
  -t, --type TYPE       限定类型: error, snippet, decision, context
  -T, --tag TAG         按标签搜索
  -j, --json            JSON 格式输出
  -l, --list            只列出文件名
  -h, --help            显示帮助

Examples:
  $(basename "$0") "docker daemon"          # 全文搜索
  $(basename "$0") -t error "permission"  # 只在错误类型中搜索
  $(basename "$0") -T docker --json        # 按标签搜索，JSON 输出
EOF
}

# 解析参数
TYPE=""
TAG=""
JSON=false
LIST=false
QUERY=""

while [[ $# -gt 0 ]]; do
  case $1 in
    -t|--type)
      TYPE="$2"
      shift 2
      ;;
    -T|--tag)
      TAG="$2"
      shift 2
      ;;
    -j|--json)
      JSON=true
      shift
      ;;
    -l|--list)
      LIST=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    -*)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
    *)
      QUERY="$1"
      shift
      ;;
  esac
done

if [[ -z "$QUERY" && -z "$TAG" ]]; then
  echo "Error: QUERY or TAG required" >&2
  usage >&2
  exit 1
fi

# 确定搜索目录
SEARCH_DIRS=()
if [[ -n "$TYPE" ]]; then
  case "$TYPE" in
    error) SEARCH_DIRS=("$WIKI_ROOT/10-errors") ;;
    snippet) SEARCH_DIRS=("$WIKI_ROOT/20-snippets") ;;
    decision) SEARCH_DIRS=("$WIKI_ROOT/30-decisions") ;;
    context) SEARCH_DIRS=("$WIKI_ROOT/40-contexts") ;;
    *)
      echo "Unknown type: $TYPE" >&2
      exit 1
      ;;
  esac
else
  SEARCH_DIRS=("$WIKI_ROOT/10-errors" "$WIKI_ROOT/20-snippets" "$WIKI_ROOT/30-decisions" "$WIKI_ROOT/40-contexts")
fi

# 执行搜索
if [[ -n "$TAG" ]]; then
  # 按标签搜索
  for dir in "${SEARCH_DIRS[@]}"; do
    if [[ -d "$dir" ]]; then
      grep -l "tags:.*- $TAG" "$dir"/*.md 2>/dev/null || true
    fi
  done
elif $LIST; then
  # 只列出文件名
  for dir in "${SEARCH_DIRS[@]}"; do
    if [[ -d "$dir" ]]; then
      grep -l "$QUERY" "$dir"/*.md 2>/dev/null || true
    fi
  done
elif $JSON; then
  # JSON 格式输出
  results=()
  for dir in "${SEARCH_DIRS[@]}"; do
    if [[ -d "$dir" ]]; then
      while IFS= read -r file; do
        if [[ -f "$file" ]]; then
          title=$(grep "^# " "$file" 2>/dev/null | head -1 | sed 's/^# //' || echo "")
          type=$(basename "$dir" | sed 's/^[0-9]*-//')
          results+=("{\"file\":\"$file\",\"title\":\"$title\",\"type\":\"$type\"}")
        fi
      done < <(grep -l "$QUERY" "$dir"/*.md 2>/dev/null || true)
    fi
  done
  echo "[$(IFS=,; echo "${results[*]}")]"
else
  # 普通输出 (带高亮)
  for dir in "${SEARCH_DIRS[@]}"; do
    if [[ -d "$dir" ]]; then
      grep -H --color=always "$QUERY" "$dir"/*.md 2>/dev/null || true
    fi
  done
fi
