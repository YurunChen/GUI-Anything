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

if [[ -n "${FLOW_NOTIFY_WECHAT_URL:-}" ]]; then
  echo "✓ WeChat URL: ${FLOW_NOTIFY_WECHAT_URL:0:50}..."
  has_config=1
fi

if [[ -n "${FLOW_NOTIFY_WECHAT_USER_ID:-}" ]]; then
  echo "✓ WeChat user id: ${FLOW_NOTIFY_WECHAT_USER_ID:0:40}..."
  has_config=1
fi

if [[ -n "${FLOW_NOTIFY_FEISHU_URL:-}" ]]; then
  echo "✓ Feishu configured: ${FLOW_NOTIFY_FEISHU_URL:0:50}..."
  has_config=1
fi

if [[ -n "${FLOW_NOTIFY_DINGTALK_URL:-}" ]]; then
  echo "✓ DingTalk configured: ${FLOW_NOTIFY_DINGTALK_URL:0:50}..."
  has_config=1
fi

echo ""

if [[ "$has_config" -eq 0 ]]; then
  echo "❌ No notification platform configured!"
  echo ""
  echo "Set at least one of:"
  echo "  FLOW_NOTIFY_WECHAT_URL / FLOW_NOTIFY_WECHAT_USER_ID"
  echo "  FLOW_NOTIFY_FEISHU_URL"
  echo "  FLOW_NOTIFY_DINGTALK_URL"
  echo ""
  echo "See docs/NOTIFICATION.md"
  exit 1
fi

echo "Configuration looks good!"
echo ""
echo "Start observer:  ${ROOT_DIR}/scripts/flow-run.sh"
echo "Then press [s] in the observer pane to send a snapshot."
echo ""
echo "WeChat Python service smoke test:  ${ROOT_DIR}/test/wechat-notify.sh"
echo "=========================================="
