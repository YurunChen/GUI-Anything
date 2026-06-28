# WeChat Notification TUI Usage

当前 TUI 通知只支持微信。

## 在 Observer 中使用

1. 启动微信服务并扫码登录。
2. 设置 `FLOW_NOTIFY_WECHAT_USER_ID`。
3. 运行 `ga flow`。
4. 在 Observer 中按 `s` 发送当前快照。

## Service API

```ts
import { NotificationService } from './services/notification/service';

const notifier = new NotificationService();

await notifier.notify({
  type: 'manual',
  priority: 'normal',
  title: 'Flow 快照',
  content: '当前状态...',
  timestamp: Date.now(),
});
```

`NotificationService` 只会发送到微信。未配置 `FLOW_NOTIFY_WECHAT_USER_ID`、处于免打扰时段或最低优先级过滤未通过时，`notify()` 返回空数组。
