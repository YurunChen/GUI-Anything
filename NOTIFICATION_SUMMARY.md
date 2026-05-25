# Flow Notification Harness - 实现总结

## 🎯 实现的功能

基于你的需求，我实现了一个完整的通知推送系统，可以将 GUI-Anything 观察到的关键信息推送到微信/飞书/钉钉。

### ✅ 已实现的推送内容

1. **🚨 错误/异常告警**（自动）
   - 检测到工具调用重复/错误时立即推送
   - 优先级：紧急 (urgent)
   - 包含错误详情和重复次数

2. **✅ 实验完成通知**（自动）
   - Flow session 结束时推送
   - 包含运行时长、工具调用次数等统计信息
   - 优先级：普通 (normal)

3. **💡 关键知识提取**（自动）
   - Observer 自动提取到重要知识点时推送
   - 基于 Wiki staging 机制触发
   - 优先级：普通 (normal)

4. **📊 阶段性进度报告**（可配置）
   - 每隔 N 分钟推送进度概览
   - 或每完成 10 个工具调用推送
   - 包含当前阶段、热点文件、统计信息
   - 优先级：低 (low)

5. **📸 手动快照**（按 `s` 键）
   - 随时推送当前状态快照
   - 包含完整的进度、阶段、文件访问统计
   - 优先级：普通 (normal)

---

## 🏗️ 技术架构

### 文件结构

```
scheme/src/services/notification/
├── types.ts                      # 类型定义
├── service.ts                    # 核心通知服务
├── flow-listener.ts              # Flow 事件监听器
├── index.ts                      # 导出文件
└── adapters/                     # 平台适配器
    ├── base.ts                   # 适配器基类
    ├── wechat.ts                 # 微信（Server酱/企业微信）
    ├── feishu.ts                 # 飞书
    ├── dingtalk.ts               # 钉钉
    └── index.ts

scheme/src/app/observer/hooks/
└── useNotification.ts            # React Hook 集成

docs/
├── NOTIFICATION.md               # 完整文档
└── NOTIFICATION_QUICKSTART.md    # 快速开始指南

scripts/
└── test/notification.sh          # 测试脚本
```

### 核心组件

1. **NotificationService** (`service.ts`)
   - 管理多个平台适配器
   - 处理推送逻辑和过滤规则
   - 支持优先级过滤、免打扰时段

2. **FlowNotificationListener** (`flow-listener.ts`)
   - 监听 ActivityTree 更新
   - 自动检测错误、完成、知识提取事件
   - 格式化消息内容

3. **Platform Adapters** (`adapters/`)
   - **WechatAdapter**: 支持 Server酱 和 企业微信机器人
   - **FeishuAdapter**: 支持飞书富文本消息和签名验证
   - **DingTalkAdapter**: 支持钉钉 Markdown 消息和签名验证

4. **useNotification Hook** (`useNotification.ts`)
   - React Hook 封装
   - 自动初始化通知服务
   - 监听 tree 和 summary 变化
   - 提供手动推送接口

---

## 🎨 UI 集成

### 新增快捷键

- **`s`**: 手动发送当前状态快照到配置的社交平台

### UI 变化

1. **状态栏显示**
   - 推送成功后显示 "✓ Snapshot sent" （3秒后消失）
   
2. **命令栏提示**
   - 配置通知后自动显示 `[s] send snapshot` 提示

---

## ⚙️ 配置方式

### 环境变量

```bash
# 平台配置（至少配置一个）
export FLOW_NOTIFY_WECHAT_URL=https://sctapi.ftqq.com/YOUR_KEY.send
export FLOW_NOTIFY_FEISHU_URL=https://open.feishu.cn/open-apis/bot/v2/hook/TOKEN
export FLOW_NOTIFY_DINGTALK_URL=https://oapi.dingtalk.com/robot/send?access_token=TOKEN

# 触发规则（可选）
export FLOW_NOTIFY_ON_ERROR=true          # 默认 true
export FLOW_NOTIFY_ON_COMPLETION=true     # 默认 true
export FLOW_NOTIFY_ON_KNOWLEDGE=true      # 默认 true
export FLOW_NOTIFY_PROGRESS_INTERVAL=10   # 默认 0（禁用）

# 过滤规则（可选）
export FLOW_NOTIFY_MIN_PRIORITY=normal    # 默认 low
export FLOW_NOTIFY_QUIET_HOURS_ENABLED=true
export FLOW_NOTIFY_QUIET_HOURS_START=22:00
export FLOW_NOTIFY_QUIET_HOURS_END=08:00
```

### 支持的平台

#### 1. 微信推送

**方式 A: Server酱（推荐个人使用）**
- 注册：https://sct.ftqq.com/
- 免费额度：每天推送上限 5 条（付费可扩展）
- 优点：简单、稳定、个人使用足够

**方式 B: 企业微信机器人**
- 创建企业微信群机器人
- 适合团队协作

#### 2. 飞书机器人
- 创建自定义机器人
- 支持富文本消息
- 支持签名验证（可选）

#### 3. 钉钉机器人
- 创建自定义机器人
- 支持 Markdown 消息
- 需要配置关键词（建议 "Flow"）

---

## 📝 使用示例

### 示例 1: 长时间实验，完成后通知我

```bash
# 只推送完成和错误，禁用其他通知
export FLOW_NOTIFY_WECHAT_URL=https://sctapi.ftqq.com/YOUR_KEY.send
export FLOW_NOTIFY_ON_ERROR=true
export FLOW_NOTIFY_ON_COMPLETION=true
export FLOW_NOTIFY_ON_KNOWLEDGE=false
export FLOW_NOTIFY_PROGRESS_INTERVAL=0

./scripts/flow-run.sh "Run full integration tests"

# 你可以离开电脑，测试完成或出错时会收到微信通知
```

### 示例 2: 夜间自动化任务

```bash
# 配置免打扰时段
export FLOW_NOTIFY_WECHAT_URL=https://sctapi.ftqq.com/YOUR_KEY.send
export FLOW_NOTIFY_QUIET_HOURS_ENABLED=true
export FLOW_NOTIFY_QUIET_HOURS_START=22:00
export FLOW_NOTIFY_QUIET_HOURS_END=08:00

# 定时任务（每天凌晨2点运行）
echo "0 2 * * * cd /path/to/GUI-Anything && ./scripts/flow-run.sh 'Nightly build'" | crontab -

# 早上起床会收到昨晚任务的结果通知
```

### 示例 3: 团队协作，推送到飞书群

```bash
# 配置飞书机器人
export FLOW_NOTIFY_FEISHU_URL=https://open.feishu.cn/open-apis/bot/v2/hook/YOUR_TOKEN
export FLOW_NOTIFY_ON_ERROR=true
export FLOW_NOTIFY_ON_COMPLETION=true
export FLOW_NOTIFY_PROGRESS_INTERVAL=15  # 每15分钟报告进度

./scripts/flow-run.sh "Deploy to production"

# 团队成员都能在飞书群看到部署进度和结果
```

---

## 💬 消息示例

### 错误告警消息

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

### 任务完成消息

```
✅ Flow 任务完成

任务已完成

📊 阶段: idle
🔧 工具调用: 67
⏱️ 已运行: 15分钟32秒
🆔 Session: a3b4c5d6...

⏰ 2026-05-18 20:45:47
```

### 手动快照消息

```
📸 Flow 快照

**当前阶段**: executing
**工具调用**: 23
**思考次数**: 12
**回复次数**: 5

📁 **热点文件**:
  • src/main.ts (8次)
  • package.json (5次)
  • README.md (3次)

⏰ 2026-05-18 20:35:15
```

---

## 🔒 安全性

### 敏感信息处理

1. **Webhook URL 不会被记录到日志**
2. **支持签名验证**（飞书/钉钉）
3. **环境变量存储，不提交到 Git**

### 签名验证配置

**飞书：**
```bash
export FLOW_NOTIFY_FEISHU_URL=https://open.feishu.cn/open-apis/bot/v2/hook/TOKEN
export FLOW_NOTIFY_FEISHU_TOKEN=YOUR_SIGN_SECRET
```

**钉钉：**
```bash
export FLOW_NOTIFY_DINGTALK_URL=https://oapi.dingtalk.com/robot/send?access_token=TOKEN
export FLOW_NOTIFY_DINGTALK_TOKEN=YOUR_SIGN_SECRET
```

---

## 🧪 测试

### 运行测试脚本

```bash
./test/notification.sh
```

这会检查你的配置是否正确。

### 手动测试

1. 启动 Observer：`./scripts/flow-run.sh`
2. 在右侧窗格按 `s` 键
3. 检查你的微信/飞书/钉钉是否收到消息

---

## 📚 文档

- **完整文档**: `docs/NOTIFICATION.md`
- **快速开始**: `docs/NOTIFICATION_QUICKSTART.md`
- **配置示例**: `.env.notification.example`

---

## 🚀 下一步可以做什么

### 可能的扩展方向

1. **更多平台支持**
   - Slack
   - Telegram
   - Email
   - Webhook (自定义服务)

2. **更智能的推送策略**
   - AI 判断是否值得推送
   - 根据错误严重程度自动调整优先级
   - 推送摘要而非所有细节

3. **推送内容优化**
   - 添加图表（进度条、统计图）
   - 支持自定义消息模板
   - 添加快捷操作按钮（如"停止任务"）

4. **与 Hermes-agent 集成**
   - 你提到的 Hermes-agent 可以作为额外的推送后端
   - 实现双向交互（从微信控制 Flow）

---

## 🎉 总结

这个 Notification Harness 实现了你的核心需求：

✅ 连通社交软件（微信/飞书/钉钉）
✅ 实时推送关键信息
✅ 自动检测错误、完成、知识提取
✅ 支持手动推送
✅ 灵活的配置选项

现在你可以：
- 运行长时间实验，离开电脑也能收到结果
- 团队协作时实时同步进度
- 夜间自动化任务，早上看结果
- 随时按 `s` 键查看当前状态

代码已经提交到 `tui_harness` 分支并推送到 GitHub！

如有任何问题或需要调整，随时告诉我！ 🚀
