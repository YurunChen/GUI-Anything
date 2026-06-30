"""
Weixin Notification Service
FastAPI server for Flow Notification to send WeChat messages
"""

import asyncio
import logging
import os
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse, PlainTextResponse
from pydantic import BaseModel

from weixin_bot import WeixinBotClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Weixin Notification Service", version="1.0.0")

# Global bot client instance
bot_client: Optional[WeixinBotClient] = None
DATA_DIR = Path(__file__).parent / "data"


class SendMessageRequest(BaseModel):
    """发送消息请求"""
    to_user_id: str
    text: str


class PairReceiverRequest(BaseModel):
    """接收人配对请求"""
    timeout_seconds: int = 60


class LoginStatusResponse(BaseModel):
    """登录状态响应"""
    logged_in: bool
    account_id: Optional[str] = None
    user_id: Optional[str] = None


class SendMessageResponse(BaseModel):
    """发送消息响应"""
    success: bool
    message: str


class PairReceiverResponse(BaseModel):
    """接收人配对响应"""
    success: bool
    user_id: Optional[str] = None
    message: str


@app.on_event("startup")
async def startup():
    """启动时初始化"""
    global bot_client

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    # Create bot client
    bot_client = WeixinBotClient(data_dir=str(DATA_DIR))

    # Enter async context
    await bot_client.__aenter__()

    # Try to load saved credentials
    if bot_client.load_credentials():
        logger.info(f"✓ Loaded saved credentials: {bot_client.account_id}")
    else:
        logger.warning("⚠ No saved credentials. Please call /login first.")


@app.on_event("shutdown")
async def shutdown():
    """关闭时清理"""
    global bot_client
    if bot_client:
        await bot_client.__aexit__(None, None, None)


@app.get("/")
async def root():
    """Health check"""
    return {"service": "weixin-notification", "status": "running"}


@app.get("/login", response_class=PlainTextResponse)
async def login_help():
    """Browser-friendly login hint."""
    return (
        "WeChat login uses POST /login so the QR code can be printed in the service terminal.\n"
        "Run one of:\n"
        "  ga notify setup\n"
        "  ./scripts/weixin-login.sh\n"
    )


@app.get("/status", response_model=LoginStatusResponse)
async def get_status():
    """获取登录状态"""
    if not bot_client:
        raise HTTPException(status_code=500, detail="Bot client not initialized")

    return LoginStatusResponse(
        logged_in=bool(bot_client.token),
        account_id=bot_client.account_id,
        user_id=bot_client.user_id
    )


@app.post("/login")
async def login():
    """
    扫码登录微信
    这是一个阻塞操作，会等待用户扫码
    """
    if not bot_client:
        raise HTTPException(status_code=500, detail="Bot client not initialized")

    if bot_client.token:
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "message": f"Already logged in as {bot_client.account_id}"
            }
        )

    # Start QR login
    try:
        success = await bot_client.qr_login(timeout_seconds=300)

        if success:
            return JSONResponse(
                status_code=200,
                content={
                    "success": True,
                    "message": "Login successful",
                    "account_id": bot_client.account_id
                }
            )
        else:
            raise HTTPException(status_code=400, detail="Login failed or timeout")

    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(status_code=500, detail=f"Login error: {str(e)}")


@app.post("/send", response_model=SendMessageResponse)
async def send_message(request: SendMessageRequest):
    """
    发送文本消息

    Args:
        request: SendMessageRequest with to_user_id and text

    Returns:
        SendMessageResponse
    """
    if not bot_client:
        raise HTTPException(status_code=500, detail="Bot client not initialized")

    if not bot_client.token:
        raise HTTPException(
            status_code=401,
            detail="Not logged in. Please call /login first"
        )

    try:
        success = await bot_client.send_text(
            to_user_id=request.to_user_id,
            text=request.text
        )

        if success:
            return SendMessageResponse(
                success=True,
                message=f"Message sent to {request.to_user_id}"
            )
        else:
            raise HTTPException(status_code=500, detail="Failed to send message")

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Send error: {e}")
        raise HTTPException(status_code=500, detail=f"Send error: {str(e)}")


@app.post("/pair-receiver", response_model=PairReceiverResponse)
async def pair_receiver(request: PairReceiverRequest):
    """等待一条发给 bot 的微信消息，并返回发送人 user id。"""
    if not bot_client:
        raise HTTPException(status_code=500, detail="Bot client not initialized")

    if not bot_client.token:
        raise HTTPException(
            status_code=401,
            detail="Not logged in. Please call /login first"
        )

    timeout_seconds = max(5, min(request.timeout_seconds, 180))
    user_id = await bot_client.wait_for_inbound_user(timeout_seconds=timeout_seconds)
    if not user_id:
        raise HTTPException(status_code=408, detail="No WeChat message received")

    return PairReceiverResponse(
        success=True,
        user_id=user_id,
        message="Receiver paired"
    )


if __name__ == "__main__":
    import uvicorn
    host = os.environ.get("FLOW_NOTIFY_WECHAT_SERVICE_HOST", "127.0.0.1")
    port = int(os.environ.get("FLOW_NOTIFY_WECHAT_SERVICE_PORT", "8765"))
    uvicorn.run(app, host=host, port=port, log_level="info")
