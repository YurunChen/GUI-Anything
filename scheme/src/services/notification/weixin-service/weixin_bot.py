"""
Weixin iLink Bot Client (精简版)
基于 Hermes-agent 的 weixin.py 实现
用于 Flow Notification 推送消息到微信
"""

import asyncio
import base64
import hashlib
import json
import logging
import os
import secrets
import struct
import time
import uuid
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

logger = logging.getLogger(__name__)

try:
    import aiohttp
    AIOHTTP_AVAILABLE = True
except ImportError:
    aiohttp = None
    AIOHTTP_AVAILABLE = False

try:
    from cryptography.hazmat.backends import default_backend
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
    CRYPTO_AVAILABLE = True
except ImportError:
    default_backend = None
    Cipher = None
    algorithms = None
    modes = None
    CRYPTO_AVAILABLE = False

# iLink API Configuration
ILINK_BASE_URL = "https://ilinkai.weixin.qq.com"
ILINK_APP_ID = "bot"
CHANNEL_VERSION = "2.2.0"
ILINK_APP_CLIENT_VERSION = (2 << 16) | (2 << 8) | 0

EP_SEND_MESSAGE = "ilink/bot/sendmessage"
EP_GET_BOT_QR = "ilink/bot/get_bot_qrcode"
EP_GET_QR_STATUS = "ilink/bot/get_qrcode_status"

API_TIMEOUT_MS = 15_000
QR_TIMEOUT_MS = 35_000

ITEM_TEXT = 1
MSG_TYPE_BOT = 2
MSG_STATE_FINISH = 2


def _random_wechat_uin() -> str:
    """Generate random UIN for headers"""
    value = struct.unpack(">I", secrets.token_bytes(4))[0]
    return base64.b64encode(str(value).encode("utf-8")).decode("ascii")


def _base_info() -> Dict[str, Any]:
    """Base info for all requests"""
    return {"channel_version": CHANNEL_VERSION}


def _headers(token: Optional[str], body: str) -> Dict[str, str]:
    """Build request headers"""
    headers = {
        "Content-Type": "application/json",
        "AuthorizationType": "ilink_bot_token",
        "Content-Length": str(len(body.encode("utf-8"))),
        "X-WECHAT-UIN": _random_wechat_uin(),
        "iLink-App-Id": ILINK_APP_ID,
        "iLink-App-ClientVersion": str(ILINK_APP_CLIENT_VERSION),
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def _json_dumps(payload: Dict[str, Any]) -> str:
    """Dump JSON without spaces"""
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))


def _make_ssl_connector() -> Optional["aiohttp.TCPConnector"]:
    """Return a TCPConnector with certifi CA bundle"""
    try:
        import ssl
        import certifi
    except ImportError:
        return None
    if not AIOHTTP_AVAILABLE:
        return None
    ssl_ctx = ssl.create_default_context(cafile=certifi.where())
    return aiohttp.TCPConnector(ssl=ssl_ctx)


class WeixinBotClient:
    """精简版微信 Bot 客户端，仅支持登录和发送文本消息"""

    def __init__(self, data_dir: str = "."):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)

        self.account_id: Optional[str] = None
        self.token: Optional[str] = None
        self.base_url: str = ILINK_BASE_URL
        self.user_id: Optional[str] = None

        self.session: Optional[aiohttp.ClientSession] = None

    async def __aenter__(self):
        """Async context manager entry"""
        self.session = aiohttp.ClientSession(
            trust_env=True,
            connector=_make_ssl_connector()
        )
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        if self.session and not self.session.closed:
            await self.session.close()

    def _account_file(self) -> Path:
        """Get account credentials file path"""
        if not self.account_id:
            return self.data_dir / "default_account.json"
        return self.data_dir / f"{self.account_id}.json"

    def save_credentials(self):
        """Save account credentials to disk"""
        if not self.account_id or not self.token:
            return

        payload = {
            "account_id": self.account_id,
            "token": self.token,
            "base_url": self.base_url,
            "user_id": self.user_id or "",
            "saved_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }

        path = self._account_file()
        path.write_text(json.dumps(payload, indent=2, ensure_ascii=False))
        try:
            path.chmod(0o600)
        except OSError:
            pass

        logger.info(f"Credentials saved to {path}")

    def load_credentials(self, account_id: Optional[str] = None) -> bool:
        """Load saved credentials"""
        if account_id:
            path = self.data_dir / f"{account_id}.json"
        else:
            # Auto-discover: try default account first, then scan for any .json file
            path = self.data_dir / "default_account.json"
            if not path.exists():
                # Scan data directory for any credential file
                json_files = list(self.data_dir.glob("*.json"))
                if json_files:
                    path = json_files[0]  # Use the first one found
                    logger.info(f"Auto-discovered credential file: {path.name}")

        if not path.exists():
            return False

        try:
            data = json.loads(path.read_text())
            self.account_id = data.get("account_id")
            self.token = data.get("token")
            self.base_url = data.get("base_url", ILINK_BASE_URL)
            self.user_id = data.get("user_id")
            logger.info(f"Credentials loaded: account_id={self.account_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to load credentials: {e}")
            return False

    async def _api_get(self, endpoint: str, timeout_ms: int = API_TIMEOUT_MS) -> Dict[str, Any]:
        """Make GET request to iLink API"""
        if not self.session:
            raise RuntimeError("Session not initialized")

        url = f"{self.base_url.rstrip('/')}/{endpoint}"
        headers = {
            "iLink-App-Id": ILINK_APP_ID,
            "iLink-App-ClientVersion": str(ILINK_APP_CLIENT_VERSION),
        }

        timeout = aiohttp.ClientTimeout(total=timeout_ms / 1000)
        async with self.session.get(url, headers=headers, timeout=timeout) as response:
            raw = await response.text()
            if not response.ok:
                raise RuntimeError(f"iLink GET {endpoint} HTTP {response.status}: {raw[:200]}")
            return json.loads(raw)

    async def _api_post(
        self,
        endpoint: str,
        payload: Dict[str, Any],
        timeout_ms: int = API_TIMEOUT_MS
    ) -> Dict[str, Any]:
        """Make POST request to iLink API"""
        if not self.session:
            raise RuntimeError("Session not initialized")

        body = _json_dumps({**payload, "base_info": _base_info()})
        url = f"{self.base_url.rstrip('/')}/{endpoint}"

        timeout = aiohttp.ClientTimeout(total=timeout_ms / 1000)
        async with self.session.post(
            url,
            data=body,
            headers=_headers(self.token, body),
            timeout=timeout
        ) as response:
            raw = await response.text()
            if not response.ok:
                raise RuntimeError(f"iLink POST {endpoint} HTTP {response.status}: {raw[:200]}")
            return json.loads(raw)

    async def qr_login(self, bot_type: str = "3", timeout_seconds: int = 480) -> bool:
        """
        QR code login flow

        Args:
            bot_type: Bot type (default "3")
            timeout_seconds: Login timeout

        Returns:
            True if login successful
        """
        if not AIOHTTP_AVAILABLE or not CRYPTO_AVAILABLE:
            raise RuntimeError("aiohttp and cryptography are required")

        # Get QR code
        try:
            qr_resp = await self._api_get(
                f"{EP_GET_BOT_QR}?bot_type={bot_type}",
                timeout_ms=QR_TIMEOUT_MS
            )
        except Exception as e:
            logger.error(f"Failed to fetch QR code: {e}")
            return False

        qrcode_value = str(qr_resp.get("qrcode") or "")
        qrcode_url = str(qr_resp.get("qrcode_img_content") or "")

        if not qrcode_value:
            logger.error("QR response missing qrcode")
            return False

        # Display QR code
        qr_scan_data = qrcode_url if qrcode_url else qrcode_value

        print("\n" + "="*60)
        print("请使用微信扫描以下二维码登录：")
        print("="*60)

        if qrcode_url:
            print(f"\n链接: {qrcode_url}\n")

        try:
            import qrcode
            qr = qrcode.QRCode()
            qr.add_data(qr_scan_data)
            qr.make(fit=True)
            qr.print_ascii(invert=True)
        except Exception as e:
            print(f"（二维码渲染失败: {e}，请直接访问上面的链接）")

        print("="*60)
        print("等待扫码...", end="", flush=True)

        # Poll for QR status
        deadline = time.monotonic() + timeout_seconds
        current_base_url = ILINK_BASE_URL
        refresh_count = 0

        while time.monotonic() < deadline:
            try:
                status_resp = await self._api_get(
                    f"{EP_GET_QR_STATUS}?qrcode={qrcode_value}",
                    timeout_ms=QR_TIMEOUT_MS
                )
            except asyncio.TimeoutError:
                await asyncio.sleep(1)
                continue
            except Exception as e:
                logger.warning(f"QR poll error: {e}")
                await asyncio.sleep(1)
                continue

            status = str(status_resp.get("status") or "wait")

            if status == "wait":
                print(".", end="", flush=True)
            elif status == "scaned":
                print("\n✓ 已扫码，请在微信中确认...")
            elif status == "scaned_but_redirect":
                redirect_host = str(status_resp.get("redirect_host") or "")
                if redirect_host:
                    current_base_url = f"https://{redirect_host}"
            elif status == "expired":
                refresh_count += 1
                if refresh_count > 3:
                    print("\n✗ 二维码多次过期，请重新执行登录。")
                    return False
                print(f"\n⚠ 二维码已过期，正在刷新... ({refresh_count}/3)")
                # Re-fetch QR code
                try:
                    qr_resp = await self._api_get(
                        f"{EP_GET_BOT_QR}?bot_type={bot_type}",
                        timeout_ms=QR_TIMEOUT_MS
                    )
                    qrcode_value = str(qr_resp.get("qrcode") or "")
                    qrcode_url = str(qr_resp.get("qrcode_img_content") or "")
                    qr_scan_data = qrcode_url if qrcode_url else qrcode_value
                    if qrcode_url:
                        print(f"新链接: {qrcode_url}")
                    try:
                        import qrcode as _qr
                        qr = _qr.QRCode()
                        qr.add_data(qr_scan_data)
                        qr.make(fit=True)
                        qr.print_ascii(invert=True)
                    except Exception:
                        pass
                except Exception as e:
                    logger.error(f"QR refresh failed: {e}")
                    return False
            elif status == "confirmed":
                self.account_id = str(status_resp.get("ilink_bot_id") or "")
                self.token = str(status_resp.get("bot_token") or "")
                self.base_url = str(status_resp.get("baseurl") or ILINK_BASE_URL)
                self.user_id = str(status_resp.get("ilink_user_id") or "")

                if not self.account_id or not self.token:
                    logger.error("QR confirmed but credentials incomplete")
                    return False

                self.save_credentials()
                print(f"\n✓ 微信登录成功！")
                print(f"  Account ID: {self.account_id}")
                print("="*60)
                return True

            await asyncio.sleep(1)

        print("\n✗ 登录超时。")
        return False

    async def send_text(self, to_user_id: str, text: str) -> bool:
        """
        Send text message

        Args:
            to_user_id: Target user ID (微信ID)
            text: Message text

        Returns:
            True if sent successfully
        """
        if not self.token:
            raise RuntimeError("Not logged in. Please call qr_login() first.")

        if not text or not text.strip():
            raise ValueError("Message text cannot be empty")

        client_id = f"flow-notify-{uuid.uuid4().hex}"

        message = {
            "from_user_id": "",
            "to_user_id": to_user_id,
            "client_id": client_id,
            "message_type": MSG_TYPE_BOT,
            "message_state": MSG_STATE_FINISH,
            "item_list": [
                {
                    "type": ITEM_TEXT,
                    "text_item": {"text": text}
                }
            ],
        }

        try:
            resp = await self._api_post(
                EP_SEND_MESSAGE,
                {"msg": message},
                timeout_ms=API_TIMEOUT_MS
            )

            ret = resp.get("ret", 0)
            errcode = resp.get("errcode", 0)

            if ret not in {0, None} or errcode not in {0, None}:
                errmsg = resp.get("errmsg") or resp.get("msg") or "unknown error"
                raise RuntimeError(f"Send failed: ret={ret} errcode={errcode} errmsg={errmsg}")

            logger.info(f"Message sent to {to_user_id[:8]}...")
            return True

        except Exception as e:
            logger.error(f"Failed to send message: {e}")
            return False


# CLI for testing
async def main_cli():
    import argparse

    parser = argparse.ArgumentParser(description="Weixin iLink Bot Client")
    parser.add_argument("--login", action="store_true", help="Login with QR code")
    parser.add_argument("--send", metavar="USER_ID", help="Send test message to user")
    parser.add_argument("--message", default="Hello from Flow Notify!", help="Message text")
    parser.add_argument("--data-dir", default="./weixin_data", help="Data directory")

    args = parser.parse_args()

    async with WeixinBotClient(data_dir=args.data_dir) as bot:
        if args.login:
            success = await bot.qr_login()
            if not success:
                print("Login failed")
                return 1
        else:
            # Try to load saved credentials
            if not bot.load_credentials():
                print("No saved credentials. Please run with --login first.")
                return 1

        if args.send:
            success = await bot.send_text(args.send, args.message)
            if success:
                print(f"✓ Message sent to {args.send}")
            else:
                print(f"✗ Failed to send message")
                return 1

    return 0


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    exit_code = asyncio.run(main_cli())
    exit(exit_code)
