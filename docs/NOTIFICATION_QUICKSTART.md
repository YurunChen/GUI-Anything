# Flow Notification 快速开始

## 5 分钟配置指南

### 方式 1：微信推送（最简单）

**步骤：**

1. 访问 https://sct.ftqq.com/
2. 使用微信扫码登录
3. 复制你的 SendKey
4. 设置环境变量：

```bash
export FLOW_NOTIFY_WECHAT_URL=https://sctapi.ftqq.com/YOUR_SENDKEY.send
```

5. 启动 Flow Observer：

```bash
./scripts/flow-run.sh
```

6. 测试推送：在 Observer 右侧窗格按 `s` 键

**完成！** 你会在微信"服务通知"收到推送消息。

---

### 方式 2：飞书推送

**步骤：**

1. 打开飞书群聊
2. 点击群设置 → 机器人 → 添加机器人 → 自定义机器人
3. 设置名称为 "Flow Observer"
4. 复制 Webhook 地址
5. 设置环境变量：

```bash
export FLOW_NOTIFY_FEISHU_URL=https://open.feishu.cn/open-apis/bot/v2/hook/YOUR_TOKEN
```

6. 启动并测试（同上）

---

### 方式 3：钉钉推送

**步骤：**

1. 打开钉钉群
2. 点击群设置 → 智能群助手 → 添加机器人 → 自定义
3. 设置名称为 "Flow Observer"
4. 安全设置选择"自定义关键词"，添加关键词 "Flow"
5. 复制 Webhook 地址
6. 设置环境变量：

```bash
export FLOW_NOTIFY_DINGTALK_URL=https://oapi.dingtalk.com/robot/send?access_token=YOUR_TOKEN
```

7. 启动并测试（同上）

---

## 常见场景配置

### 场景：只在出错时提醒我

```bash
export FLOW_NOTIFY_WECHAT_URL=https://sctapi.ftqq.com/YOUR_KEY.send
export FLOW_NOTIFY_ON_ERROR=true
export FLOW_NOTIFY_ON_COMPLETION=false
export FLOW_NOTIFY_ON_KNOWLEDGE=false

./scripts/flow-run.sh "Run integration tests"
```

### 场景：夜间自动化，早上看结果

```bash
export FLOW_NOTIFY_WECHAT_URL=https://sctapi.ftqq.com/YOUR_KEY.send
export FLOW_NOTIFY_QUIET_HOURS_ENABLED=true
export FLOW_NOTIFY_QUIET_HOURS_START=22:00
export FLOW_NOTIFY_QUIET_HOURS_END=08:00

# 定时任务
echo "0 2 * * * cd /path/to/project && ./scripts/flow-run.sh 'Nightly build'" | crontab -
```

### 场景：多平台同时推送

```bash
export FLOW_NOTIFY_WECHAT_URL=https://sctapi.ftqq.com/YOUR_KEY.send
export FLOW_NOTIFY_FEISHU_URL=https://open.feishu.cn/open-apis/bot/v2/hook/YOUR_TOKEN
export FLOW_NOTIFY_PLATFORMS=wechat,feishu

./scripts/flow-run.sh
```

---

## 环境变量速查

| 变量 | 说明 | 示例 |
|------|------|------|
| `FLOW_NOTIFY_WECHAT_URL` | 微信推送地址 | Server酱/企业微信 URL |
| `FLOW_NOTIFY_FEISHU_URL` | 飞书推送地址 | 飞书 Webhook URL |
| `FLOW_NOTIFY_DINGTALK_URL` | 钉钉推送地址 | 钉钉 Webhook URL |
| `FLOW_NOTIFY_ON_ERROR` | 错误时推送 | `true` (默认) |
| `FLOW_NOTIFY_ON_COMPLETION` | 完成时推送 | `true` (默认) |
| `FLOW_NOTIFY_ON_KNOWLEDGE` | 知识提取时推送 | `true` (默认) |
| `FLOW_NOTIFY_MIN_PRIORITY` | 最低优先级 | `low`/`normal`/`high`/`urgent` |

---

## 快捷键

| 按键 | 功能 |
|------|------|
| `s` | 手动发送当前状态快照到配置的平台 |

---

## 故障排查

**问题：按 `s` 没反应**
- 检查是否配置了 Webhook URL
- 运行 `./test/notification.sh` 检查配置

**问题：收不到消息**
- 检查 Webhook URL 是否正确
- 测试网络连接：`curl -X POST $FLOW_NOTIFY_WECHAT_URL -d '{"title":"test"}'`
- 查看 Observer 控制台是否有错误信息

**问题：钉钉提示"关键词不匹配"**
- 在机器人安全设置中添加关键词 "Flow"

---

更多详细配置请查看 [完整文档](NOTIFICATION.md)。
