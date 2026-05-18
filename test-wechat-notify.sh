#!/bin/bash
# Quick test for WeChat notification via TypeScript service

export FLOW_NOTIFY_WECHAT_USER_ID="o9cq803R8Xbwtv1IAnt9wnH4EYVU@im.wechat"

echo "Testing WeChat notification integration..."
echo ""
echo "Environment:"
echo "  FLOW_NOTIFY_WECHAT_USER_ID: $FLOW_NOTIFY_WECHAT_USER_ID"
echo ""

# Direct HTTP test
echo "Sending test message via Python service..."
curl -s -X POST http://127.0.0.1:8765/send \
  -H "Content-Type: application/json" \
  -d "{
    \"to_user_id\": \"$FLOW_NOTIFY_WECHAT_USER_ID\",
    \"text\": \"✅ 集成测试成功！\\n\\n来自 Flow Observer 的微信推送已正常工作。\\n\\n⏰ $(date '+%Y-%m-%d %H:%M:%S')\"
  }" | jq

echo ""
echo "✓ Test complete! Check your WeChat for the message."
