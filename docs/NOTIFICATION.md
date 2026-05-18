# Flow Notification Harness

将 GUI-Anything 的关键事件推送到微信/飞书/钉钉，随时随地掌握 Flow 进度。

## 📱 支持平台

| 平台 | 支持方式 | 适用场景 |
|------|---------|---------|
| **微信** | Server酱 / 企业微信机器人 | 个人使用 / 团队协作 |
| **飞书** | 自定义机器人 Webhook | 团队协作 |
| **钉钉** | 自定义机器人 Webhook | 团队协作 |

## 🔔 推送内容

### 自动推送（默认启用）

| 事件类型 | 触发时机 | 优先级 |
|---------|---------|--------|
| 🚨 **错误告警** | 检测到错误或重复操作 | 紧急 (urgent) |
| ✅ **任务完成** | Flow session 结束 | 普通 (normal) |
| 💡 **知识提取** | Observer 自动提取关键知识点 | 普通 (normal) |
| 📊 **进度报告** | 每 N 分钟或每 10 个工具调用 | 低 (low) |

### 手动推送

在 Observer 界面按 `s` 键，立即推送当前状态快照。

## 🚀 快速开始

### 1. 配置推送平台

选择你常用的平台之一进行配置：

#### 方式 A: 微信 (Server酱 - 推荐个人使用)

1. 访问 [Server酱官网](https://sct.ftqq.com/)
2. 使用微信扫码登录
3. 获取 **SendKey**
4. 设置环境变量：

```bash
export FLOW_NOTIFY_WECHAT_URL=https://sctapi.ftqq.com/YOUR_SENDKEY.send
```

#### 方式 B: 飞书机器人

1. 打开飞书群聊 → **设置** → **机器人** → **添加机器人** → **自定义机器人**
2. 设置机器人名称（如 "Flow Observer"）
3. 复制 **Webhook 地址**
4. 设置环境变量：

```bash
export FLOW_NOTIFY_FEISHU_URL=https://open.feishu.cn/open-apis/bot/v2/hook/YOUR_TOKEN
```

#### 方式 C: 钉钉机器人

1. 打开钉钉群 → **群设置** → **智能群助手** → **添加机器人** → **自定义**
2. 设置机器人名称（如 "Flow Observer"）
3. 安全设置选择 **自定义关键词**，添加关键词 "Flow"
4. 复制 **Webhook 地址**
5. 设置环境变量：

```bash
export FLOW_NOTIFY_DINGTALK_URL=https://oapi.dingtalk.com/robot/send?access_token=YOUR_TOKEN
```

### 2. 启动 Flow Observer

```bash
# 正常启动（会自动加载环境变量）
./scripts/flow-run.sh

# 或使用 .env 文件
cp .env.notification.example .env
# 编辑 .env 填入你的配置
./scripts/flow-run.sh
```

### 3. 验证配置

启动后，Observer 会自动发送测试消息到配置的平台，确认连接正常。

## ⚙️ 高级配置

### 完整环境变量

```bash
# 启用/禁用通知
export FLOW_NOTIFY_ENABLED=true

# 选择启用的平台（可多选，逗号分隔）
export FLOW_NOTIFY_PLATFORMS=wechat,feishu

# 自动触发规则
export FLOW_NOTIFY_ON_ERROR=true           # 错误时推送
export FLOW_NOTIFY_ON_COMPLETION=true      # 完成时推送
export FLOW_NOTIFY_ON_KNOWLEDGE=true       # 知识提取时推送
export FLOW_NOTIFY_PROGRESS_INTERVAL=10    # 每 10 分钟推送进度 (0=禁用)

# 过滤规则
export FLOW_NOTIFY_MIN_PRIORITY=normal     # 最低优先级: low/normal/high/urgent

# 免打扰时段
export FLOW_NOTIFY_QUIET_HOURS_ENABLED=true
export FLOW_NOTIFY_QUIET_HOURS_START=22:00
export FLOW_NOTIFY_QUIET_HOURS_END=08:00
```

### 同时使用多个平台

```bash
# 配置所有平台
export FLOW_NOTIFY_WECHAT_URL=https://sctapi.ftqq.com/YOUR_KEY.send
export FLOW_NOTIFY_FEISHU_URL=https://open.feishu.cn/open-apis/bot/v2/hook/YOUR_TOKEN
export FLOW_NOTIFY_DINGTALK_URL=https://oapi.dingtalk.com/robot/send?access_token=YOUR_TOKEN

# 同时推送到所有平台
export FLOW_NOTIFY_PLATFORMS=wechat,feishu,dingtalk
```

### 加签安全配置

**飞书加签**：
```bash
export FLOW_NOTIFY_FEISHU_URL=https://open.feishu.cn/open-apis/bot/v2/hook/YOUR_TOKEN
export FLOW_NOTIFY_FEISHU_TOKEN=YOUR_SIGN_SECRET
```

**钉钉加签**：
```bash
export FLOW_NOTIFY_DINGTALK_URL=https://oapi.dingtalk.com/robot/send?access_token=YOUR_TOKEN
export FLOW_NOTIFY_DINGTALK_TOKEN=YOUR_SIGN_SECRET
```

## 📋 使用示例

### 场景 1: 长时间实验，只关心结果

```bash
# 禁用进度通知，只推送错误和完成
export FLOW_NOTIFY_ON_ERROR=true
export FLOW_NOTIFY_ON_COMPLETION=true
export FLOW_NOTIFY_ON_KNOWLEDGE=false
export FLOW_NOTIFY_PROGRESS_INTERVAL=0

./scripts/flow-run.sh "Run full integration tests"
```

你可以离开电脑，测试完成或出错时会收到微信/飞书/钉钉通知。

### 场景 2: 实时监控，频繁更新

```bash
# 启用所有通知，每 5 分钟报告进度
export FLOW_NOTIFY_ON_ERROR=true
export FLOW_NOTIFY_ON_COMPLETION=true
export FLOW_NOTIFY_ON_KNOWLEDGE=true
export FLOW_NOTIFY_PROGRESS_INTERVAL=5

./scripts/flow-run.sh
```

### 场景 3: 夜间静音，白天提醒

```bash
# 晚上 10 点到早上 8 点免打扰
export FLOW_NOTIFY_QUIET_HOURS_ENABLED=true
export FLOW_NOTIFY_QUIET_HOURS_START=22:00
export FLOW_NOTIFY_QUIET_HOURS_END=08:00

./scripts/flow-run.sh
```

### 场景 4: 手动快照

在 Observer 右侧窗格按 `s` 键，立即推送当前状态：

```
📸 Flow 快照

当前阶段: executing
工具调用: 23
思考次数: 12
回复次数: 5

📁 热点文件:
  • src/main.ts (8次)
  • package.json (5次)
  • README.md (3次)

⏰ 2026-05-18 20:45:32
```

## 🔍 故障排查

### 消息推送失败

1. **检查 Webhook URL 是否正确**：
   ```bash
   echo $FLOW_NOTIFY_WECHAT_URL
   ```

2. **测试网络连接**：
   ```bash
   curl -X POST $FLOW_NOTIFY_WECHAT_URL \
     -H "Content-Type: application/json" \
     -d '{"title":"测试","desp":"Hello"}'
   ```

3. **查看 Observer 日志**：
   Observer 会在控制台输出推送失败的详细信息。

### 钉钉提示"关键词不匹配"

钉钉机器人安全设置中添加关键词 **"Flow"** 或 **"Claude"**。

### 免打扰时段不生效

确保时间格式为 `HH:MM`（24小时制），例如 `22:00` 而非 `22:0`。

## 🎨 自定义消息格式

如需自定义消息格式，编辑 `scheme/src/services/notification/adapters/` 下的适配器文件。

## 📊 消息示例

### 错误告警

```
🚨 Flow 检测到错误

检测到 2 个新错误或重复操作

错误详情:
Read: package.json (5次重复)
Bash: npm install (3次重复)

📊 阶段: executing
🔧 工具调用: 45
🆔 Session: a3b4c5d6...

⏰ 2026-05-18 20:30:15
```

### 任务完成

```
✅ Flow 任务完成

任务已完成

📊 阶段: idle
🔧 工具调用: 67
⏱️ 已运行: 15分钟32秒
🆔 Session: a3b4c5d6...

⏰ 2026-05-18 20:45:47
```

### 知识提取

```
💡 新知识提取

检测到关键架构决策：使用 OpenTUI 替代传统 TUI 框架，支持 React 组件复用。

🆔 Session: a3b4c5d6...
📂 Project: /home/user/GUI-Anything

⏰ 2026-05-18 20:35:22
```

## 🤝 集成到其他工具

### 与 GitHub Actions 集成

```yaml
# .github/workflows/flow-notify.yml
- name: Run Flow Observer
  env:
    FLOW_NOTIFY_FEISHU_URL: ${{ secrets.FEISHU_WEBHOOK }}
  run: |
    ./scripts/flow-run.sh "Run CI tests"
```

### 与 Cron 定时任务集成

```bash
# crontab -e
0 2 * * * cd /path/to/project && FLOW_NOTIFY_WECHAT_URL=$SENDKEY ./scripts/flow-run.sh "Nightly build"
```

## 📚 更多信息

- [Server酱文档](https://sct.ftqq.com/sendkey)
- [飞书机器人文档](https://open.feishu.cn/document/client-docs/bot-v3/add-custom-bot)
- [钉钉机器人文档](https://open.dingtalk.com/document/robots/custom-robot-access)
