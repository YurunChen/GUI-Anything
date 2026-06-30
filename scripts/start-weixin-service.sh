#!/bin/bash
#
# Start Weixin Notification Service
# 启动微信推送服务（Python FastAPI）
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SERVICE_DIR="$PROJECT_ROOT/scheme/src/services/notification/weixin-service"
VENV_DIR="$SERVICE_DIR/.venv"
PYTHON_BIN="${PYTHON:-python3}"
SERVICE_HOST="${FLOW_NOTIFY_WECHAT_SERVICE_HOST:-127.0.0.1}"
SERVICE_PORT="${FLOW_NOTIFY_WECHAT_SERVICE_PORT:-8765}"
SERVICE_URL="${FLOW_NOTIFY_WECHAT_SERVICE_URL:-http://${SERVICE_HOST}:${SERVICE_PORT}}"

if [[ "$SERVICE_URL" =~ ^https?://(\[[^]]+\]|[^/:]+)(:([0-9]+))?(/.*)?$ ]]; then
    if [[ -z "${FLOW_NOTIFY_WECHAT_SERVICE_HOST:-}" ]]; then
        SERVICE_HOST="${BASH_REMATCH[1]}"
        SERVICE_HOST="${SERVICE_HOST#[}"
        SERVICE_HOST="${SERVICE_HOST%]}"
    fi
    if [[ -z "${FLOW_NOTIFY_WECHAT_SERVICE_PORT:-}" && -n "${BASH_REMATCH[3]:-}" ]]; then
        SERVICE_PORT="${BASH_REMATCH[3]}"
    fi
fi

BACKGROUND=0
RESTART=0
QUIET=0
for arg in "$@"; do
    case "$arg" in
        --background|-d) BACKGROUND=1 ;;
        --restart|-y|--yes) RESTART=1 ;;
        --quiet|-q) QUIET=1 ;;
    esac
done

say() {
    [[ "$QUIET" == "1" ]] || echo "$@"
}

say "=========================================="
say "  Weixin Notification Service"
say "=========================================="
say ""

# Check if Python 3 is available
if ! command -v "$PYTHON_BIN" &> /dev/null; then
    echo "❌ Python 3 not found"
    echo ""
    echo "Please install Python 3:"
    echo "  macOS:   brew install python3"
    echo "  Ubuntu:  sudo apt-get install python3 python3-pip"
    echo ""
    exit 1
fi

PYTHON_VERSION=$("$PYTHON_BIN" --version 2>&1 | awk '{print $2}')
say "✓ Python 3 found: $PYTHON_VERSION"

# Check if service directory exists
if [ ! -d "$SERVICE_DIR" ]; then
    echo "❌ Service directory not found: $SERVICE_DIR"
    exit 1
fi

cd "$SERVICE_DIR"

ensure_venv() {
    if [ ! -x "$VENV_DIR/bin/python" ]; then
        say "Creating local Python virtualenv..."
        "$PYTHON_BIN" -m venv "$VENV_DIR"
    fi

    VENV_PYTHON="$VENV_DIR/bin/python"
    if ! "$VENV_PYTHON" -m pip --version >/dev/null 2>&1; then
        echo "❌ pip is unavailable in the local virtualenv"
        echo "Please install Python with venv/ensurepip support, then retry."
        exit 1
    fi
}

# Check if dependencies are installed
say ""
say "Checking dependencies..."

ensure_venv

if ! "$VENV_DIR/bin/python" -c "import aiohttp, fastapi, uvicorn, qrcode, cryptography" 2>/dev/null; then
    say "⚠ Dependencies not installed"
    say ""
    say "Installing dependencies into local virtualenv..."
    if [[ "$QUIET" == "1" ]]; then
        "$VENV_DIR/bin/python" -m pip install -q -r requirements.txt
    else
        "$VENV_DIR/bin/python" -m pip install -r requirements.txt
    fi
    say ""
fi

say "✓ Dependencies OK"
say ""

# Check if already running
LISTEN_PIDS="$(lsof -Pi :"$SERVICE_PORT" -sTCP:LISTEN -t 2>/dev/null || true)"
if [[ -n "$LISTEN_PIDS" ]]; then
    say "⚠ Service already running on port $SERVICE_PORT"
    say ""
    if [[ "$RESTART" == "1" ]]; then
        say "Stopping existing service..."
        kill $LISTEN_PIDS 2>/dev/null || true
        sleep 1
    else
        read -p "Kill existing process and restart? (y/N) " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "Stopping existing service..."
            kill $LISTEN_PIDS 2>/dev/null || true
            sleep 1
        else
            echo "Exiting."
            exit 0
        fi
    fi
fi

# Start service
say "Starting Weixin Notification Service..."
say "  URL: $SERVICE_URL"
say "  Logs: $SERVICE_DIR/weixin-service.log"
say ""
say "=========================================="
say ""

# Run in background or foreground
if [[ "$BACKGROUND" == "1" ]]; then
    FLOW_NOTIFY_WECHAT_SERVICE_HOST="$SERVICE_HOST" FLOW_NOTIFY_WECHAT_SERVICE_PORT="$SERVICE_PORT" nohup "$VENV_DIR/bin/python" server.py > weixin-service.log 2>&1 &
    PID=$!
    say "✓ Service started in background"
    say ""
else
    echo "Press Ctrl+C to stop the service"
    echo ""
    FLOW_NOTIFY_WECHAT_SERVICE_HOST="$SERVICE_HOST" FLOW_NOTIFY_WECHAT_SERVICE_PORT="$SERVICE_PORT" "$VENV_DIR/bin/python" server.py
fi
