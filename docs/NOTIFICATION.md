# Flow WeChat Notification

GUI-Anything 目前只维护微信通知。微信通道基于本地 iLink Bot Python 服务，Observer 把关键 Flow 事件推送到配对后的微信用户。

## 支持内容

| 事件 | 触发时机 | 默认 |
|------|----------|------|
| 错误告警 | Observer 检测到 error 级重复操作 | 开启 |
| Exploration digest | 按 `s` 后，下一轮起每个新完成 exploration 的简短摘要 | 开启 |
| 知识提取 | 新的可持久化 summary 生成后 | 开启 |
| 进度报告 | 工具调用每增加 10 次后按间隔检查 | 默认关闭 |
| 手动开启 | 在 Observer 按 `s` 后开启本轮提醒 | 开启 |

完成通知目前只保留 service API，Observer 退出路径尚未稳定接入自动触发。

## 快速开始

推荐使用 CLI 向导：

```bash
ga notify setup
```

它会启动本地微信服务、引导扫码登录、自动配对接收人、保存本地配置，并发送一条测试消息。
首次配置时，向导会提示你按 Enter 后，用接收账号在 60 秒内给 bot 发一条微信消息来完成配对；不要只依赖扫码登录返回的 user id。
重复运行 setup 会重启本地微信服务，避免复用旧进程。

如果需要重新开始，可以清理本地通知状态：

```bash
ga notify clean
```

它会停止本地微信通知服务，并删除 `.flow-runtime/notify.env` 与本项目保存的 WeChat 登录凭据。

手动配置步骤如下。

1. 启动微信服务：

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

4. 启动 Flow：

```bash
ga flow
```

在 Observer 右侧窗格按 `s` 可开启本轮微信提醒；Observer 不驱动 Claude，按下后继续在左侧执行 Claude 任务。
开启后会记录当前已有 exploration 作为 baseline，从下一轮 exploration 开始，每个新完成的 exploration 会在 summary ready/failed 后发送一条简短 digest。

详细登录和 user id 获取方式见 [NOTIFICATION_WECHAT.md](NOTIFICATION_WECHAT.md)。

## 配置

```bash
export FLOW_NOTIFY_ENABLED=true
export FLOW_NOTIFY_WECHAT_USER_ID=<your_wechat_id>
export FLOW_NOTIFY_WECHAT_SERVICE_URL=http://127.0.0.1:8765

export FLOW_NOTIFY_ON_ERROR=true
export FLOW_NOTIFY_ON_COMPLETION=true
export FLOW_NOTIFY_ON_KNOWLEDGE=true
export FLOW_NOTIFY_PROGRESS_INTERVAL=0

export FLOW_NOTIFY_MIN_PRIORITY=low
export FLOW_NOTIFY_QUIET_HOURS_ENABLED=false
export FLOW_NOTIFY_QUIET_HOURS_START=22:00
export FLOW_NOTIFY_QUIET_HOURS_END=08:00
```

说明：

- `FLOW_NOTIFY_ENABLED=false` 会隐藏 `s notify on` 热键。
- 未设置接收人时通知不可用；运行 `ga notify setup` 配置。
- 未配置时，`ga flow` 会提示运行 `ga notify setup`，Observer 状态栏也会显示 `WeChat notify not configured`。
- `FLOW_NOTIFY_PROGRESS_INTERVAL` 单位为分钟，`0` 表示禁用进度通知。
- `FLOW_NOTIFY_MIN_PRIORITY` 可选 `low`、`normal`、`high`、`urgent`。
- 免打扰时段使用本机时间，支持跨午夜，例如 `22:00` 到 `08:00`。

## 测试

检查配置：

```bash
ga notify status
ga notify test
./test/notification.sh
```

直接测试微信服务发送：

```bash
./test/wechat-notify.sh
```

服务状态：

```bash
curl http://127.0.0.1:8765/status
```

## 故障排查

按 `s` 没反应：

- 确认 `FLOW_NOTIFY_ENABLED` 不是 `false`。
- 确认已设置 `FLOW_NOTIFY_WECHAT_USER_ID`。
- 确认焦点在右侧 Observer；按下后状态栏应显示 `WeChat notify on`。

提示发送失败：

- 确认微信服务已启动：`./scripts/start-weixin-service.sh`
- 确认已扫码登录：`./scripts/weixin-login.sh`
- 查看服务日志：`tail -f scheme/src/services/notification/weixin-service/weixin-service.log`

`ga notify test` 显示发送成功但手机没有收到：

- 这通常表示 iLink send 接口接受了请求，但保存的 receiver 不是当前微信可投递的会话。
- 运行 `ga notify clean` 清掉旧通知配置和登录凭据后，再运行 `ga notify setup`，按提示先按 Enter，再从接收消息的微信账号给 bot 发任意消息完成配对。
- 重新配置后再运行 `ga notify test`，确认手机微信能看到 bot 会话里的测试消息。

本地凭证：

- 微信登录凭证保存在 `scheme/src/services/notification/weixin-service/data/`。
- 该目录是本地运行数据，不应提交到 git。
