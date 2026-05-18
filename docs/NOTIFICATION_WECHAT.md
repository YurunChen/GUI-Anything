# 微信推送配置指南（iLink Bot API）

基于腾讯 iLink Bot API，通过扫码登录微信个人号，直接推送消息。

---

## 🎯 特点

- ✅ **扫码登录** - 无需第三方服务
- ✅ **直接推送** - 消息发送到个人微信
- ✅ **官方 API** - 基于腾讯 iLink Bot 协议
- ✅ **持久化登录** - 凭证自动保存，无需重复登录

---

## 📋 准备工作

### 1. 安装 Python 依赖

微信推送使用独立的 Python 微服务（基于 Hermes-agent 实现）。

```bash
cd scheme/src/services/notification/weixin-service
pip3 install -r requirements.txt
```

需要的包：
- `aiohttp` - 异步 HTTP 客户端
- `cryptography` - AES 加密
- `fastapi` - Web 框架
- `uvicorn` - ASGI 服务器
- `qrcode` - 二维码生成

---

## 🚀 快速开始

### 步骤 1：启动微信服务

```bash
./scripts/start-weixin-service.sh
```

服务会在 `http://127.0.0.1:8765` 启动。

**后台运行：**
```bash
./scripts/start-weixin-service.sh --background
```

### 步骤 2：扫码登录微信

```bash
./scripts/weixin-login.sh
```

会显示一个二维码，用你的微信扫码并确认登录。

**或者手动调用 API：**
```bash
curl -X POST http://127.0.0.1:8765/login
```

### 步骤 3：配置环境变量

登录成功后，设置接收消息的微信用户ID：

```bash
export FLOW_NOTIFY_WECHAT_USER_ID=<your_wechat_id>
```

**如何获取微信用户ID？**
- 方法1：让对方给你发条消息，在服务日志中查看 `from_user_id`
- 方法2：使用你自己的微信ID（给自己发送）

### 步骤 4：启动 Flow Observer

```bash
./scripts/flow-run.sh
```

现在按 `s` 键就能将快照推送到微信了！

---

## ⚙️ 配置

### 环境变量

```bash
# 必需：接收消息的微信用户ID
export FLOW_NOTIFY_WECHAT_USER_ID=<user_id>

# 可选：Python服务地址（默认: http://127.0.0.1:8765）
export FLOW_NOTIFY_WECHAT_SERVICE_URL=http://127.0.0.1:8765

# 可选：自动触发规则
export FLOW_NOTIFY_ON_ERROR=true
export FLOW_NOTIFY_ON_COMPLETION=true
export FLOW_NOTIFY_ON_KNOWLEDGE=true
```

### 持久化凭证

登录凭证保存在：
```
scheme/src/services/notification/weixin-service/data/{account_id}.json
```

文件权限自动设置为 `600`（仅所有者可读写）。

重启服务会自动加载保存的凭证，无需重新登录。

---

## 🛠️ API 文档

微信服务提供 REST API：

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

扫码登录微信

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

---

## 🧪 测试

### 测试服务状态

```bash
curl http://127.0.0.1:8765/status
```

### 测试发送消息

```bash
curl -X POST http://127.0.0.1:8765/send \
  -H "Content-Type: application/json" \
  -d '{
    "to_user_id": "YOUR_WECHAT_ID",
    "text": "Test message from Flow Notify"
  }'
```

### 使用 CLI 测试

```bash
cd scheme/src/services/notification/weixin-service

# 登录
python weixin_bot.py --login --data-dir ./data

# 发送消息
python weixin_bot.py --send YOUR_WECHAT_ID \
  --message "Test message" \
  --data-dir ./data
```

---

## 🔧 故障排查

### 问题：服务无法启动

**症状：**
```
python3: command not found
```

**解决：**
```bash
# macOS
brew install python3

# Ubuntu/Debian
sudo apt-get install python3 python3-pip

# 检查版本
python3 --version
```

### 问题：依赖安装失败

**症状：**
```
ModuleNotFoundError: No module named 'aiohttp'
```

**解决：**
```bash
cd scheme/src/services/notification/weixin-service
pip3 install -r requirements.txt
```

### 问题：登录超时

**症状：**
```
✗ 登录超时。
```

**解决：**
1. 检查网络连接
2. 确保能访问 `https://ilinkai.weixin.qq.com`
3. 重新运行 `./scripts/weixin-login.sh`

### 问题：发送失败

**症状：**
```
[WechatAdapter] Send failed
```

**检查步骤：**
1. 服务是否运行？`curl http://127.0.0.1:8765/`
2. 是否已登录？`curl http://127.0.0.1:8765/status`
3. `FLOW_NOTIFY_WECHAT_USER_ID` 是否正确？
4. 查看服务日志：`tail -f scheme/src/services/notification/weixin-service/weixin-service.log`

### 问题：端口被占用

**症状：**
```
⚠ Service already running on port 8765
```

**解决：**
```bash
# 查看占用端口的进程
lsof -i :8765

# 杀死进程
kill $(lsof -t -i:8765)

# 重新启动
./scripts/start-weixin-service.sh
```

---

## 📖 技术细节

### 架构

```
┌─────────────────┐
│  Flow Observer  │
│  (TypeScript)   │
└────────┬────────┘
         │ HTTP
         ↓
┌─────────────────┐
│  Weixin Service │
│  (Python/FastAPI)│
└────────┬────────┘
         │ iLink Bot API
         ↓
┌─────────────────┐
│  WeChat Server  │
│  (Tencent)      │
└─────────────────┘
```

### iLink Bot API

- **Base URL**: `https://ilinkai.weixin.qq.com`
- **协议**: iLink Bot 2.2.0
- **认证**: Bearer Token
- **加密**: AES-128-ECB（媒体文件）

### 消息格式

发送的文本消息格式：
```json
{
  "from_user_id": "",
  "to_user_id": "target_user",
  "client_id": "unique_id",
  "message_type": 2,
  "message_state": 2,
  "item_list": [
    {
      "type": 1,
      "text_item": {
        "text": "消息内容"
      }
    }
  ]
}
```

---

## 🔒 安全性

### 凭证保护

- 登录凭证存储在本地文件
- 文件权限自动设置为 `600`
- Token 不会写入日志

### 网络安全

- 服务默认只监听 `127.0.0.1`（本地）
- 使用 HTTPS 连接到腾讯服务器
- 支持 certifi CA bundle

---

## 🤝 与 Hermes-agent 的关系

本实现基于 [Hermes-agent](https://github.com/nousresearch/hermes-agent) 的 `weixin.py`：

- 复用了 iLink Bot API 客户端逻辑
- 简化为仅支持登录和文本消息发送
- 封装为独立的 HTTP 服务

感谢 Hermes-agent 团队的开源贡献！

---

## 📚 参考资料

- [Hermes-agent GitHub](https://github.com/nousresearch/hermes-agent)
- [腾讯 iLink Bot 文档](https://open.weixin.qq.com/)

---

## 💡 提示

### 自动启动服务

你可以将服务添加到系统自启动：

**macOS (launchd):**
创建 `~/Library/LaunchAgents/com.flow.weixin.plist`

**Linux (systemd):**
创建 `/etc/systemd/system/flow-weixin.service`

### 给自己发送

最简单的方式是给自己发送消息：
1. 登录后，你的微信ID就是 bot account ID
2. 设置 `FLOW_NOTIFY_WECHAT_USER_ID` 为你自己的微信ID
3. 消息会出现在"文件传输助手"风格的对话框
