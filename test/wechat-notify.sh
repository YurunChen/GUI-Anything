#!/usr/bin/env bash
# Smoke test: WeChat notification via local Python service (127.0.0.1:8765)

set -euo pipefail

: "${FLOW_NOTIFY_WECHAT_USER_ID:?Set FLOW_NOTIFY_WECHAT_USER_ID before running}"

echo "Testing WeChat notification..."
echo "  FLOW_NOTIFY_WECHAT_USER_ID: ${FLOW_NOTIFY_WECHAT_USER_ID}"
echo ""

curl -s -X POST http://127.0.0.1:8765/send \
  -H "Content-Type: application/json" \
  -d "{
    \"to_user_id\": \"${FLOW_NOTIFY_WECHAT_USER_ID}\",
    \"text\": \"✅ Flow Observer WeChat smoke test\\n\\n⏰ $(date '+%Y-%m-%d %H:%M:%S')\"
  }" | (command -v jq >/dev/null && jq . || cat)

echo ""
echo "✓ Request sent — check WeChat if the Python service is running."
