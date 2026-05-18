# Weixin Notification Service

基于腾讯 iLink Bot API 的微信推送服务，用于 Flow Notification。

## 功能

- ✅ 扫码登录微信（QR code login）
- ✅ 发送文本消息到微信
- ✅ 持久化登录凭证
- ✅ HTTP API 接口

## 依赖

```bash
pip install -r requirements.txt
```

需要的包：
- `aiohttp` - 异步 HTTP 客户端
- `cryptography` - AES 加密
- `fastapi` - Web 框架
- `uvicorn` - ASGI 服务器
- `qrcode` - 二维码生成

## 快速开始

### 1. 安装依赖

```bash
cd scheme/src/services/notification/weixin-service
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python server.py
```

服务会在 `http://127.0.0.1:8765` 启动。

### 3. 扫码登录

```bash
curl -X POST http://127.0.0.1:8765/login
```

在终端扫描二维码，用微信确认登录。

### 4. 发送消息

```bash
curl -X POST http://127.0.0.1:8765/send \
  -H "Content-Type: application/json" \
  -d '{
    "to_user_id": "YOUR_WECHAT_ID",
    "text": "Hello from Flow Notify!"
  }'
```

## API 文档

### GET /status

获取登录状态

**响应：**
```json
{
  "logged_in": true,
  "account_id": "xxx@im.bot"
}
```

### POST /login

扫码登录微信（阻塞，等待扫码确认）

**响应：**
```json
{
  "success": true,
  "message": "Login successful",
  "account_id": "xxx@im.bot"
}
```

### POST /send

发送文本消息

**请求：**
```json
{
  "to_user_id": "wechat_user_id",
  "text": "Message text"
}
```

**响应：**
```json
{
  "success": true,
  "message": "Message sent to wechat_user_id"
}
```

## CLI 测试

你也可以直接使用 CLI 测试：

```bash
# 登录
python weixin_bot.py --login --data-dir ./data

# 发送消息
python weixin_bot.py --send YOUR_WECHAT_ID --message "Test message" --data-dir ./data
```

## 数据存储

登录凭证保存在 `data/` 目录：
- `data/{account_id}.json` - 账号凭证
- 文件权限自动设置为 `600`（仅所有者可读写）

## 技术细节

### iLink Bot API

基于 Hermes-agent 的实现，使用腾讯的 iLink Bot API：
- Base URL: `https://ilinkai.weixin.qq.com`
- 协议版本: `2.2.0`
- 认证方式: Bearer Token

### 消息格式

文本消息使用 `ITEM_TEXT` 类型：
```json
{
  "type": 1,
  "text_item": {
    "text": "消息内容"
  }
}
```

### 错误处理

- 401: 未登录，需要先调用 `/login`
- 400: 请求参数错误
- 500: 服务器内部错误

## 与 TypeScript 集成

TypeScript 代码通过 HTTP 调用此服务：

```typescript
// Send message
const response = await fetch('http://127.0.0.1:8765/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    to_user_id: 'user_id',
    text: 'message'
  })
});
```

## 故障排查

### 问题：登录超时

**解决**：
- 确保网络正常
- 重新运行 `/login`
- 检查二维码是否过期

### 问题：发送失败

**解决**：
- 检查 `to_user_id` 是否正确
- 确认已登录（调用 `/status` 检查）
- 查看服务日志

### 问题：依赖安装失败

**解决**：
```bash
# macOS
brew install python3

# Ubuntu/Debian
sudo apt-get install python3 python3-pip

# 然后安装依赖
pip3 install -r requirements.txt
```

## License

基于 Hermes-agent 的 weixin.py 实现
