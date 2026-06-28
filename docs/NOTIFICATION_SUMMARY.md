# Notification Summary

通知功能已收敛为微信唯一通道。

## 链路

`FlowObserverShell` 按键 `s` → `useNotification` → `FlowNotificationListener` → `NotificationService` → `WechatAdapter` → 本地 `weixin-service` → 微信。

## 维护入口

- TypeScript service: `scheme/src/services/notification/`
- Python 微信服务: `scheme/src/services/notification/weixin-service/`
- 快速开始: [NOTIFICATION_QUICKSTART.md](NOTIFICATION_QUICKSTART.md)
- 完整说明: [NOTIFICATION.md](NOTIFICATION.md)
- 微信登录指南: [NOTIFICATION_WECHAT.md](NOTIFICATION_WECHAT.md)

本地登录凭证位于 `scheme/src/services/notification/weixin-service/data/`，属于运行数据，不应提交。
