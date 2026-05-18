#!/bin/bash
#
# Flow Notification 测试脚本
# 用于测试推送配置是否正确
#

set -e

echo "=========================================="
echo "  Flow Notification Test"
echo "=========================================="
echo ""

# 检查环境变量
echo "Checking configuration..."
echo ""

has_config=0

if [ -n "$FLOW_NOTIFY_WECHAT_URL" ]; then
  echo "✓ WeChat configured: ${FLOW_NOTIFY_WECHAT_URL:0:50}..."
  has_config=1
fi

if [ -n "$FLOW_NOTIFY_FEISHU_URL" ]; then
  echo "✓ Feishu configured: ${FLOW_NOTIFY_FEISHU_URL:0:50}..."
  has_config=1
fi

if [ -n "$FLOW_NOTIFY_DINGTALK_URL" ]; then
  echo "✓ DingTalk configured: ${FLOW_NOTIFY_DINGTALK_URL:0:50}..."
  has_config=1
fi

echo ""

if [ $has_config -eq 0 ]; then
  echo "❌ No notification platform configured!"
  echo ""
  echo "Please set at least one of:"
  echo "  - FLOW_NOTIFY_WECHAT_URL"
  echo "  - FLOW_NOTIFY_FEISHU_URL"
  echo "  - FLOW_NOTIFY_DINGTALK_URL"
  echo ""
  echo "See docs/NOTIFICATION.md for setup guide."
  exit 1
fi

echo "Configuration looks good!"
echo ""
echo "To test notifications, start Flow Observer:"
echo "  ./scripts/flow-run.sh"
echo ""
echo "Then press [s] in the Observer pane to send a test snapshot."
echo ""
echo "=========================================="
