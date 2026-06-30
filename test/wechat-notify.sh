#!/usr/bin/env bash
# Smoke test: WeChat notification via local Python service.

set -euo pipefail

: "${FLOW_NOTIFY_WECHAT_USER_ID:?Set FLOW_NOTIFY_WECHAT_USER_ID before running}"
SERVICE_URL="${FLOW_NOTIFY_WECHAT_SERVICE_URL:-http://127.0.0.1:8765}"

echo "Testing WeChat notification..."
echo "  FLOW_NOTIFY_WECHAT_USER_ID: ${FLOW_NOTIFY_WECHAT_USER_ID}"
echo ""

curl -s -X POST "$SERVICE_URL/send" \
  -H "Content-Type: application/json" \
  -d "{
    \"to_user_id\": \"${FLOW_NOTIFY_WECHAT_USER_ID}\",
    \"text\": \"✅ Flow Observer WeChat smoke test\\n\\n⏰ $(date '+%Y-%m-%d %H:%M:%S')\"
  }" | (command -v jq >/dev/null && jq . || cat)

echo ""
echo "✓ Request sent — check WeChat if the Python service is running."
