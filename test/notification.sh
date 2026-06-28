#!/usr/bin/env bash
#
# Flow Notification 测试脚本 — 检查推送环境变量是否已配置
#

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "=========================================="
echo "  Flow Notification Test"
echo "=========================================="
echo ""

echo "Checking configuration..."
echo ""

has_config=0

if [[ -n "${FLOW_NOTIFY_WECHAT_USER_ID:-}" ]]; then
  echo "✓ WeChat user id: ${FLOW_NOTIFY_WECHAT_USER_ID:0:40}..."
  has_config=1
fi

echo ""

if [[ "$has_config" -eq 0 ]]; then
  echo "❌ WeChat notification is not configured!"
  echo ""
  echo "Set:"
  echo "  FLOW_NOTIFY_WECHAT_USER_ID"
  echo ""
  echo "See docs/NOTIFICATION.md"
  exit 1
fi

echo "Configuration looks good!"
echo "WeChat service URL: ${FLOW_NOTIFY_WECHAT_SERVICE_URL:-http://127.0.0.1:8765}"
echo ""
echo "Start observer:  ${ROOT_DIR}/scripts/flow-run.sh"
echo "Then press [s] in the observer pane to send a snapshot."
echo ""
echo "WeChat Python service smoke test:  ${ROOT_DIR}/test/wechat-notify.sh"
echo "=========================================="
