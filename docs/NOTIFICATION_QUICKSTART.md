# Flow WeChat Notification Quickstart

当前通知功能只支持微信。

## 5 分钟配置

推荐：

```bash
ga notify setup
```

已有接收人配置会复用；没有配置时会自动配对接收人。
如果需要，向导会提示你用接收账号给 bot 发一条微信消息。

手动配置：

1. 启动本地微信服务：

```bash
./scripts/start-weixin-service.sh
```

2. 扫码登录：

```bash
./scripts/weixin-login.sh
```

3. 设置接收人，推荐使用 `ga notify setup` 自动生成；手动模式可导出已知 user id：

```bash
export FLOW_NOTIFY_WECHAT_USER_ID=<your_wechat_id>
```

4. 启动 Observer：

```bash
ga flow
```

5. 在 Observer 右侧窗格按 `s` 发送快照。

未配置时，`ga flow` 会提示运行 `ga notify setup`，Observer 状态栏会显示微信通知未配置。

## 常用配置

只在错误时提醒：

```bash
export FLOW_NOTIFY_WECHAT_USER_ID=<your_wechat_id>
export FLOW_NOTIFY_ON_ERROR=true
export FLOW_NOTIFY_ON_KNOWLEDGE=false
export FLOW_NOTIFY_PROGRESS_INTERVAL=0
ga flow "Run integration tests"
```

夜间静音：

```bash
export FLOW_NOTIFY_QUIET_HOURS_ENABLED=true
export FLOW_NOTIFY_QUIET_HOURS_START=22:00
export FLOW_NOTIFY_QUIET_HOURS_END=08:00
ga flow
```

## 环境变量速查

| 变量 | 说明 |
|------|------|
| `FLOW_NOTIFY_WECHAT_USER_ID` | 接收消息的微信用户 ID |
| `FLOW_NOTIFY_WECHAT_SERVICE_URL` | 本地微信服务地址，默认 `http://127.0.0.1:8765` |
| `FLOW_NOTIFY_ENABLED` | `false` 时禁用通知 |
| `FLOW_NOTIFY_ON_ERROR` | error 告警自动推送 |
| `FLOW_NOTIFY_ON_KNOWLEDGE` | 可持久化知识生成后自动推送 |
| `FLOW_NOTIFY_PROGRESS_INTERVAL` | 进度通知间隔分钟数，`0` 禁用 |
| `FLOW_NOTIFY_MIN_PRIORITY` | 最低优先级：`low`、`normal`、`high`、`urgent` |

## 故障排查

```bash
ga notify status
ga notify test
./test/notification.sh
./test/wechat-notify.sh
curl http://127.0.0.1:8765/status
```

更多信息见 [NOTIFICATION.md](NOTIFICATION.md) 和 [NOTIFICATION_WECHAT.md](NOTIFICATION_WECHAT.md)。
