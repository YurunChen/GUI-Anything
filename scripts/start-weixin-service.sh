#!/bin/bash
#
# Start Weixin Notification Service
# 启动微信推送服务（Python FastAPI）
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SERVICE_DIR="$PROJECT_ROOT/scheme/src/services/notification/weixin-service"

echo "=========================================="
echo "  Weixin Notification Service"
echo "=========================================="
echo ""

# Check if Python 3 is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found"
    echo ""
    echo "Please install Python 3:"
    echo "  macOS:   brew install python3"
    echo "  Ubuntu:  sudo apt-get install python3 python3-pip"
    echo ""
    exit 1
fi

PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
echo "✓ Python 3 found: $PYTHON_VERSION"

# Check if service directory exists
if [ ! -d "$SERVICE_DIR" ]; then
    echo "❌ Service directory not found: $SERVICE_DIR"
    exit 1
fi

cd "$SERVICE_DIR"

# Check if dependencies are installed
echo ""
echo "Checking dependencies..."

if ! python3 -c "import aiohttp" 2>/dev/null; then
    echo "⚠ Dependencies not installed"
    echo ""
    echo "Installing dependencies..."
    pip3 install -r requirements.txt
    echo ""
fi

echo "✓ Dependencies OK"
echo ""

# Check if already running
if lsof -Pi :8765 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "⚠ Service already running on port 8765"
    echo ""
    read -p "Kill existing process and restart? (y/N) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Stopping existing service..."
        kill $(lsof -t -i:8765) 2>/dev/null || true
        sleep 1
    else
        echo "Exiting."
        exit 0
    fi
fi

# Start service
echo "Starting Weixin Notification Service..."
echo "  URL: http://127.0.0.1:8765"
echo "  Logs: $SERVICE_DIR/weixin-service.log"
echo ""
echo "=========================================="
echo ""

# Run in background or foreground
if [ "$1" == "--background" ] || [ "$1" == "-d" ]; then
    nohup python3 server.py > weixin-service.log 2>&1 &
    PID=$!
    echo "✓ Service started in background (PID: $PID)"
    echo ""
    echo "To view logs:"
    echo "  tail -f $SERVICE_DIR/weixin-service.log"
    echo ""
    echo "To login (scan QR code):"
    echo "  curl -X POST http://127.0.0.1:8765/login"
    echo ""
    echo "To check status:"
    echo "  curl http://127.0.0.1:8765/status"
    echo ""
else
    echo "Press Ctrl+C to stop the service"
    echo ""
    python3 server.py
fi
