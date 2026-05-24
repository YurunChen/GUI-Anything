# 在 TUI 中使用微信通知

## 方式 1: 使用 NotificationService（推荐）

这是最简单的方式，已经处理了所有细节（配置、重试、多平台等）。

### 示例 1: 基础使用

```typescript
import { NotificationService } from './services/notification/service';

// 1. 创建服务实例（会自动读取环境变量）
const notificationService = new NotificationService();

// 2. 发送通知
async function sendWechatNotification() {
  const results = await notificationService.notify({
    type: 'manual',           // 消息类型: error, completion, knowledge, progress, manual
    priority: 'normal',       // 优先级: low, normal, high, urgent
    title: '📸 Flow 快照',
    content: `当前阶段: executing\n工具调用: 23\n思考次数: 12`,
    timestamp: Date.now(),
    metadata: {
      sessionId: 'abc123',
      projectDir: '/path/to/project'
    }
  });

  // 检查结果
  results.forEach(result => {
    if (result.success) {
      console.log(`✓ 推送成功: ${result.platform}`);
    } else {
      console.error(`✗ 推送失败: ${result.platform} - ${result.error}`);
    }
  });
}
```

### 示例 2: 快捷方法

```typescript
// 发送错误通知（自动添加 🚨 emoji）
await notificationService.notifyError(
  'Flow 检测到错误',
  '检测到 2 个新错误或重复操作',
  'Read: package.json (5次重复)'
);

// 发送完成通知（自动添加 ✅ emoji）
await notificationService.notifyCompletion(
  'Flow 任务完成',
  '任务已完成',
  { duration: '15分钟32秒', toolCalls: 67 }
);

// 发送知识提取通知（自动添加 💡 emoji）
await notificationService.notifyKnowledge(
  '新知识提取',
  '检测到关键架构决策：使用 OpenTUI 替代传统 TUI 框架'
);

// 发送进度通知（自动添加 📊 emoji，带间隔控制）
await notificationService.notifyProgress(
  'Flow 进度报告',
  '已运行 10 分钟，完成 45 个工具调用'
);
```

### 示例 3: 在 TUI 中集成（按键触发）

这是你的 Observer 中按 's' 键发送快照的实现：

```typescript
// scheme/src/ui/tui/FlowObserverApp.tsx
import { NotificationService } from '../../services/notification/service';

export function FlowObserverApp() {
  const [notificationService] = useState(() => new NotificationService());

  // 按键处理
  const handleKeyPress = async (key: string) => {
    if (key === 's') {
      // 发送快照到微信
      await sendSnapshot();
    }
  };

  const sendSnapshot = async () => {
    const stats = getCurrentStats(); // 获取当前统计信息

    await notificationService.notify({
      type: 'manual',
      priority: 'low',
      title: '📸 Flow 快照',
      content: formatSnapshot(stats),
      timestamp: Date.now(),
      metadata: {
        sessionId: stats.sessionId,
        phase: stats.currentPhase,
        toolCallCount: stats.toolCallCount
      }
    });
  };

  return <YourTUIComponent onKeyPress={handleKeyPress} />;
}
```

## 方式 2: 直接调用 Python 服务（底层）

如果你不想用 NotificationService，可以直接调用 HTTP API：

```typescript
// 直接发送微信消息
async function sendDirectWechatMessage(text: string) {
  const toUserId = process.env.FLOW_NOTIFY_WECHAT_USER_ID || 'o9cq803R8Xbwtv1IAnt9wnH4EYVU@im.wechat';
  const serviceUrl = process.env.FLOW_NOTIFY_WECHAT_SERVICE_URL || 'http://127.0.0.1:8765';

  try {
    const response = await fetch(`${serviceUrl}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to_user_id: toUserId,
        text: text
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('发送失败:', error);
      return false;
    }

    const result = await response.json();
    return result.success;
  } catch (error) {
    console.error('发送失败:', error);
    return false;
  }
}

// 使用
await sendDirectWechatMessage('🎉 测试消息\n\n来自 Flow Observer');
```

## 方式 3: 从命令行/Shell 调用

如果你在 shell 脚本中需要发送通知：

```bash
#!/bin/bash
# 发送微信消息

USER_ID="${FLOW_NOTIFY_WECHAT_USER_ID:-o9cq803R8Xbwtv1IAnt9wnH4EYVU@im.wechat}"
SERVICE_URL="${FLOW_NOTIFY_WECHAT_SERVICE_URL:-http://127.0.0.1:8765}"

send_wechat() {
  local message="$1"
  
  curl -s -X POST "${SERVICE_URL}/send" \
    -H "Content-Type: application/json" \
    -d "{
      \"to_user_id\": \"${USER_ID}\",
      \"text\": \"${message}\"
    }"
}

# 使用
send_wechat "🚀 部署完成\n\n服务已成功启动"
```

## 完整示例：Observer 集成

```typescript
// scheme/src/main.ts 或你的 TUI 入口文件

import { NotificationService } from './services/notification/service';
import type { FlowState } from './core/types';

class FlowObserver {
  private notificationService: NotificationService;
  private lastState: FlowState | null = null;

  constructor() {
    // 初始化通知服务（自动读取环境变量）
    this.notificationService = new NotificationService({
      enabled: true,
      platforms: ['wechat', 'feishu', 'dingtalk'],
      autoTriggers: {
        onError: true,        // 自动推送错误
        onCompletion: true,   // 自动推送完成
        onKnowledge: true,    // 自动推送知识提取
        progressInterval: 0   // 禁用定时进度（只手动触发）
      }
    });
  }

  async onStateChange(newState: FlowState) {
    // 检测错误
    if (this.detectErrors(newState)) {
      await this.notificationService.notifyError(
        'Flow 检测到错误',
        this.formatErrors(newState)
      );
    }

    // 检测任务完成
    if (this.isCompleted(newState)) {
      await this.notificationService.notifyCompletion(
        'Flow 任务完成',
        this.formatCompletion(newState)
      );
    }

    this.lastState = newState;
  }

  // 手动快照（按 's' 键触发）
  async sendSnapshot() {
    if (!this.lastState) return;

    await this.notificationService.notify({
      type: 'manual',
      priority: 'low',
      title: '📸 Flow 快照',
      content: this.formatSnapshot(this.lastState),
      timestamp: Date.now()
    });
  }

  private formatSnapshot(state: FlowState): string {
    return `
当前阶段: ${state.phase}
工具调用: ${state.toolCallCount}
思考次数: ${state.thinkingCount}
回复次数: ${state.responseCount}

📁 热点文件:
${state.hotFiles.slice(0, 5).map(f => `  • ${f.path} (${f.count}次)`).join('\n')}

⏰ ${new Date().toLocaleString('zh-CN')}
    `.trim();
  }
}
```

## 环境变量配置

在启动 TUI 之前设置：

```bash
# 必需：微信用户ID
export FLOW_NOTIFY_WECHAT_USER_ID=o9cq803R8Xbwtv1IAnt9wnH4EYVU@im.wechat

# 可选：Python 服务地址（默认 http://127.0.0.1:8765）
export FLOW_NOTIFY_WECHAT_SERVICE_URL=http://127.0.0.1:8765

# 可选：启用/禁用通知
export FLOW_NOTIFY_ENABLED=true

# 可选：只启用微信
export FLOW_NOTIFY_PLATFORMS=wechat
```

或使用 `.env` 文件：

```bash
cp .env.notification.example .env
# 编辑 .env 填入配置
```

## Python 服务管理

在使用前确保 Python 服务在运行：

```bash
# 启动服务（前台）
./scripts/start-weixin-service.sh

# 启动服务（后台）
./scripts/start-weixin-service.sh --background

# 扫码登录（仅需一次）
./scripts/weixin-login.sh

# 检查状态
curl http://127.0.0.1:8765/status

# 停止服务
kill $(lsof -t -i:8765)
```

## 故障排查

### 消息发送失败

1. **检查 Python 服务是否运行**：
   ```bash
   curl http://127.0.0.1:8765/status
   ```
   应返回 `{"logged_in": true, "account_id": "..."}`

2. **检查是否已登录**：
   如果返回 `{"logged_in": false}`，运行：
   ```bash
   ./scripts/weixin-login.sh
   ```

3. **检查环境变量**：
   ```bash
   echo $FLOW_NOTIFY_WECHAT_USER_ID
   ```

4. **查看 Python 服务日志**：
   ```bash
   tail -f scheme/src/services/notification/weixin-service/weixin-service.log
   ```

### TypeScript 编译错误

确保导入路径正确：

```typescript
// ✓ 正确
import { NotificationService } from './services/notification/service';

// ✗ 错误
import { NotificationService } from 'notification/service';
```

## API 参考

### NotificationMessage 类型

```typescript
interface NotificationMessage {
  type: 'error' | 'completion' | 'knowledge' | 'progress' | 'manual';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  title: string;
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}
```

### NotificationService 方法

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `notify(message)` | `NotificationMessage` | `Promise<NotificationResult[]>` | 发送通知到所有启用平台 |
| `notifyError(title, content, details?)` | `string, string, string?` | `Promise<NotificationResult[]>` | 发送错误通知 |
| `notifyCompletion(title, content, metadata?)` | `string, string, object?` | `Promise<NotificationResult[]>` | 发送完成通知 |
| `notifyKnowledge(title, content, metadata?)` | `string, string, object?` | `Promise<NotificationResult[]>` | 发送知识通知 |
| `notifyProgress(title, content, metadata?)` | `string, string, object?` | `Promise<NotificationResult[]>` | 发送进度通知 |
| `testAll()` | - | `Promise<Record<PlatformType, boolean>>` | 测试所有平台 |

## 总结

**推荐流程**：

1. ✅ 启动 Python 服务：`./scripts/start-weixin-service.sh --background`
2. ✅ 扫码登录（仅首次）：`./scripts/weixin-login.sh`
3. ✅ 设置环境变量：`export FLOW_NOTIFY_WECHAT_USER_ID=<your_id>`
4. ✅ 在 TUI 中导入 `NotificationService`
5. ✅ 调用 `notificationService.notify()` 或快捷方法

**最简单的集成**：

```typescript
import { NotificationService } from './services/notification/service';

const notifier = new NotificationService();

// 发送消息
await notifier.notify({
  type: 'manual',
  priority: 'normal',
  title: '🎉 测试',
  content: '来自 TUI 的微信推送',
  timestamp: Date.now()
});
```

就这么简单！🚀
