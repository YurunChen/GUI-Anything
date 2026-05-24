#!/bin/bash
#
# Weixin QR Login Helper
# 微信扫码登录助手
#

set -e

SERVICE_URL="${FLOW_NOTIFY_WECHAT_SERVICE_URL:-http://127.0.0.1:8765}"

echo "=========================================="
echo "  Weixin QR Login"
echo "=========================================="
echo ""

# Check if service is running
if ! curl -s "$SERVICE_URL/" > /dev/null 2>&1; then
    echo "❌ Weixin service not running at $SERVICE_URL"
    echo ""
    echo "Please start the service first:"
    echo "  ./scripts/start-weixin-service.sh"
    echo ""
    exit 1
fi

echo "✓ Service is running"
echo ""

# Check current status
STATUS=$(curl -s "$SERVICE_URL/status")
LOGGED_IN=$(echo "$STATUS" | grep -o '"logged_in":[^,}]*' | cut -d: -f2)

if [ "$LOGGED_IN" == "true" ]; then
    ACCOUNT_ID=$(echo "$STATUS" | grep -o '"account_id":"[^"]*"' | cut -d'"' -f4)
    echo "✓ Already logged in as: $ACCOUNT_ID"
    echo ""
    read -p "Re-login? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Exiting."
        exit 0
    fi
fi

# Start login
echo "Starting QR login..."
echo "Please scan the QR code with WeChat on your phone"
echo ""
echo "=========================================="
echo ""

curl -X POST "$SERVICE_URL/login" 2>/dev/null

echo ""
echo "=========================================="
echo ""

# Check if login was successful
STATUS=$(curl -s "$SERVICE_URL/status")
LOGGED_IN=$(echo "$STATUS" | grep -o '"logged_in":[^,}]*' | cut -d: -f2)

if [ "$LOGGED_IN" == "true" ]; then
    ACCOUNT_ID=$(echo "$STATUS" | grep -o '"account_id":"[^"]*"' | cut -d'"' -f4)
    echo "✓ Login successful!"
    echo "  Account ID: $ACCOUNT_ID"
    echo ""
    echo "You can now use Flow Notification with WeChat."
    echo ""
    echo "Set your WeChat user ID:"
    echo "  export FLOW_NOTIFY_WECHAT_USER_ID=<your_wechat_id>"
    echo ""
else
    echo "❌ Login failed"
    echo ""
    echo "Please try again or check the service logs:"
    echo "  tail -f scheme/src/services/notification/weixin-service/weixin-service.log"
    echo ""
    exit 1
fi
