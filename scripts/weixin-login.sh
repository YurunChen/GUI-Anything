#!/bin/bash
#
# Weixin QR Login Helper
# 微信扫码登录助手
#

set -e

SERVICE_HOST="${FLOW_NOTIFY_WECHAT_SERVICE_HOST:-127.0.0.1}"
SERVICE_PORT="${FLOW_NOTIFY_WECHAT_SERVICE_PORT:-8765}"
SERVICE_URL="${FLOW_NOTIFY_WECHAT_SERVICE_URL:-http://${SERVICE_HOST}:${SERVICE_PORT}}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SERVICE_LOG="$PROJECT_ROOT/scheme/src/services/notification/weixin-service/weixin-service.log"
TAIL_PID=""

cleanup_tail() {
    if [[ -n "$TAIL_PID" ]]; then
        kill "$TAIL_PID" 2>/dev/null || true
        wait "$TAIL_PID" 2>/dev/null || true
    fi
}
trap cleanup_tail EXIT

echo "=========================================="
echo "  WeChat Login"
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

# Check current status
STATUS=$(curl -s "$SERVICE_URL/status")
LOGGED_IN=$(echo "$STATUS" | grep -o '"logged_in":[^,}]*' | cut -d: -f2)

if [ "$LOGGED_IN" == "true" ]; then
    echo "Already logged in."
    echo ""
    read -p "Re-login? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Exiting."
        exit 0
    fi
fi

# Start login
echo "Scan the QR code with WeChat."
echo ""
echo "=========================================="
echo ""

if [[ -f "$SERVICE_LOG" ]]; then
    tail -n 0 -f "$SERVICE_LOG" &
    TAIL_PID=$!
else
    echo "Log file not found yet: $SERVICE_LOG"
    echo "If no QR code appears, check the service terminal."
fi

curl -s -X POST "$SERVICE_URL/login" 2>/dev/null
cleanup_tail
TAIL_PID=""

echo ""
echo "=========================================="
echo ""

# Check if login was successful
STATUS=$(curl -s "$SERVICE_URL/status")
LOGGED_IN=$(echo "$STATUS" | grep -o '"logged_in":[^,}]*' | cut -d: -f2)

if [ "$LOGGED_IN" == "true" ]; then
    echo "Login successful."
else
    echo "Login failed."
    echo ""
    echo "Please try again or check the service logs:"
    echo "  tail -f scheme/src/services/notification/weixin-service/weixin-service.log"
    echo ""
    exit 1
fi
