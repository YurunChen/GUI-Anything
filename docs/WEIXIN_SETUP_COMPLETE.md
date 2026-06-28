# ✅ 微信推送功能完成！

## 🎉 已实现

基于 **Hermes-agent 的 iLink Bot API**，实现了扫码登录微信并推送通知的功能。

---

## 📦 架构

```
┌──────────────────────────────────┐
│  GUI-Anything (TypeScript/Bun)  │
│  Flow Observer                   │
└────────────┬─────────────────────┘
             │ HTTP API
             ↓
┌──────────────────────────────────┐
│  Weixin Service (Python)         │
│  - FastAPI Server                │
│  - iLink Bot Client              │
│  - Port: 8765                    │
└────────────┬─────────────────────┘
             │ iLink Bot Protocol
             ↓
┌──────────────────────────────────┐
│  WeChat (Tencent)                │
│  - iLink Bot API                 │
│  - 扫码登录                       │
└──────────────────────────────────┘
```

---

## 🚀 使用流程

### 1. 安装 Python 依赖

```bash
./scripts/setup.sh
```

依赖会安装到 `scheme/src/services/notification/weixin-service/.venv/`，不会写入系统 Python。

### 2. 启动微信服务

```bash
./scripts/start-weixin-service.sh
```

或后台运行：
```bash
./scripts/start-weixin-service.sh --background
```

### 3. 扫码登录

```bash
./scripts/weixin-login.sh
```

终端会显示二维码，用微信扫码确认登录。

### 4. 配置接收人

```bash
ga notify setup
```

### 5. 启动 Flow Observer

```bash
./scripts/flow-run.sh
```

### 6. 测试推送

在 Observer 右侧窗格按 **`s`** 键，快照会推送到你的微信！

---

## 📁 文件清单

### Python 微服务
```
scheme/src/services/notification/weixin-service/
├── weixin_bot.py          # iLink Bot 客户端（精简版 Hermes-agent）
├── server.py              # FastAPI 服务
├── requirements.txt       # Python 依赖
└── README.md             # 服务文档
```

### TypeScript 集成
```
scheme/src/services/notification/adapters/
└── wechat.ts             # 微信适配器（调用 Python 服务）
```

### 脚本
```
scripts/
├── start-weixin-service.sh   # 启动微信服务
└── weixin-login.sh           # 登录助手
```

### 文档
```
docs/
└── NOTIFICATION_WECHAT.md    # 完整微信配置指南
```

---

## 🔧 API 端点

微信服务提供 3 个端点：

| 端点 | 方法 | 功能 |
|------|------|------|
| `/status` | GET | 获取登录状态 |
| `/login` | POST | 扫码登录（阻塞） |
| `/send` | POST | 发送文本消息 |

### 示例

```bash
# 检查状态
curl http://127.0.0.1:8765/status

# 扫码登录
curl -X POST http://127.0.0.1:8765/login

# 发送消息
curl -X POST http://127.0.0.1:8765/send \
  -H "Content-Type: application/json" \
  -d '{
    "to_user_id": "wechat_user_id",
    "text": "Hello from Flow!"
  }'
```

---

## 🎯 与 Hermes-agent 的对比

| 特性 | Hermes-agent | GUI-Anything |
|------|-------------|--------------|
| **语言** | Python | TypeScript + Python 微服务 |
| **协议** | iLink Bot 2.2.0 | ✅ 相同 |
| **登录方式** | QR 扫码 | ✅ 相同 |
| **功能** | 双向对话 | 单向推送通知 |
| **复杂度** | 2000+ 行 | 500+ 行（精简版） |
| **用途** | AI Agent | Flow 通知 |

**实现来源**：
- 基于 `hermes-agent/gateway/platforms/weixin.py`
- 保留了核心的登录和发送逻辑
- 移除了长轮询、媒体文件、群聊等复杂功能

---

## 💡 技术细节

### iLink Bot 协议

- **Base URL**: `https://ilinkai.weixin.qq.com`
- **版本**: `2.2.0`
- **认证**: Bearer Token
- **消息类型**: 
  - `ITEM_TEXT = 1` (文本)
  - `ITEM_IMAGE = 2` (图片)
  - `ITEM_VOICE = 3` (语音)
  - `ITEM_FILE = 4` (文件)

### 凭证持久化

登录凭证保存在：
```
weixin-service/data/{account_id}.json
```

格式：
```json
{
  "account_id": "xxx@im.bot",
  "token": "...",
  "base_url": "https://ilinkai.weixin.qq.com",
  "user_id": "...",
  "saved_at": "2026-05-18T12:00:00Z"
}
```

文件权限：`600`（仅所有者可读写）

---

## 🔍 故障排查

### Python 依赖问题

```bash
# 检查 Python 版本
python3 --version  # 需要 3.7+

# 重新安装依赖
rm -rf scheme/src/services/notification/weixin-service/.venv
./scripts/setup.sh
```

### 服务无法启动

```bash
# 检查端口是否被占用
lsof -i :8765

# 杀死占用进程
kill $(lsof -t -i:8765)

# 重新启动
./scripts/start-weixin-service.sh
```

### 登录失败

1. 检查网络：能否访问 `https://ilinkai.weixin.qq.com`
2. 确保二维码未过期（60秒有效期）
3. 查看服务日志：`tail -f weixin-service/weixin-service.log`

### 发送失败

1. 确认已登录：`curl http://127.0.0.1:8765/status`
2. 检查 `FLOW_NOTIFY_WECHAT_USER_ID` 是否设置
3. 确认 user_id 正确（可以试着给自己发）

---

## 📚 完整文档

- [微信配置指南](docs/NOTIFICATION_WECHAT.md) - 完整设置步骤
- [通知系统文档](docs/NOTIFICATION.md) - 所有平台配置
- [快速开始](docs/NOTIFICATION_QUICKSTART.md) - 5分钟上手

---

## 🙏 致谢

感谢 **Hermes-agent** 团队的开源贡献！

- GitHub: https://github.com/nousresearch/hermes-agent
- 本实现基于其 `weixin.py` 简化而来

---

## ✨ 总结

现在你的 Flow Notification 支持：

✅ **微信** - iLink Bot 扫码登录（基于 Hermes-agent）  

微信通道可以接收：
- 🚨 错误告警
- ✅ 任务完成通知
- 💡 知识提取
- 📊 进度报告
- 📸 手动快照（按 `s` 键）

准备好试用了吗？🚀
