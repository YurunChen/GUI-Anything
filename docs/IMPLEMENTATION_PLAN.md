# 📋 GUI-Anything × HTML 实施计划

> **版本**: v1.0  
> **日期**: 2026-05-21  
> **总工期预估**: 3 周（核心功能）+ 持续迭代  
> **负责人**: TBD

---

## 🗺️ 总体路线图

```
Week 1                    Week 2                    Week 3                    持续迭代
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐  ┌──────────────┐
│  🎬 Session Replay  │  │  🎬 Replay 增强     │  │  🌐 Web Mirror      │  │  📊 Knowledge│
│  (MVP)              │  │  + 🎨 Theme Play.   │  │  (实时版)           │  │  + 🔥 Stream │
│                     │  │                     │  │                     │  │              │
│  · 数据层           │  │  · 播放引擎         │  │  · WebSocket 架构   │  │  · D3 图谱   │
│  · 静态 HTML 渲染   │  │  · 搜索             │  │  · 实时状态推送     │  │  · OBS 优化  │
│  · CLI 集成         │  │  · 主题切换         │  │  · 移动端 UI        │  │              │
│  · 基础交互         │  │  · 主题编辑器       │  │  · 多人连接         │  │              │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘  └──────────────┘
        ▲ MVP 发布              ▲ v1.0 发布              ▲ v1.5 发布
```

---

## 🎬 Phase 1: Session Replay HTML（Week 1）

> **目标**: 从 session JSONL → 单个可打开的 HTML 回放文件

### Day 1-2: 数据层 + 骨架

| # | 任务 | 输出 | 预估 |
|---|------|------|------|
| 1.1 | 创建 `scheme/src/export/html-replay/` 目录 | 目录结构 | 10min |
| 1.2 | 定义 `types.ts` — ReplaySessionData / ReplayExploration / ReplayNode 类型 | 类型文件 | 30min |
| 1.3 | 实现 `export-html.ts` — 主导出引擎 | 核心逻辑 | 2h |
|     | → 调用 `findLatestSession()` 找到 session 文件 | | |
|     | → 调用 `extractExplorationsFromSession()` 解析结构 | | |
|     | → 调用 `extractSessionStats()` 获取统计 | | |
|     | → 构建 `ReplaySessionData` JSON | | |
|     | → 安全脱敏（路径替换、敏感信息过滤） | | |
| 1.4 | 实现 `template.ts` — HTML 模板 | 模板字符串 | 1.5h |
|     | → Header + 播放控制条 + 双栏布局 + 底部统计 | | |
|     | → 占位符：`{{CSS}}` / `{{JS}}` / `{{DATA_JSON}}` / `{{TITLE}}` | | |
| 1.5 | 实现 `styles.ts` — 基础 CSS（先只做 transparent） | CSS 字符串 | 1.5h |
|     | → Grid 布局、时间线列表样式、节点样式、详情面板 | | |
|     | → 响应式断点（768px） | | |
| 1.6 | 实现 `player.ts` — 前端 JS（静态交互版） | JS 字符串 | 2h |
|     | → 解析嵌入的 JSON 数据 | | |
|     | → 渲染时间线（exploration 列表 + node 列表） | | |
|     | → 点击 node → 右侧显示详情 | | |
|     | → 点击 exploration → 展开/折叠 | | |
|     | → 渲染统计面板 | | |
| 1.7 | 在 `main.ts` 添加 `--export-html` CLI 入口 | CLI 集成 | 30min |

**Day 1-2 交付物**: 能跑通 `bun run src/main.ts --export-html > test.html`，浏览器打开能看到完整时间线。

### Day 3: 播放引擎

| # | 任务 | 输出 | 预估 |
|---|------|------|------|
| 1.8 | 实现 Play/Pause 按钮 + requestAnimationFrame 驱动 | 播放功能 | 1.5h |
| 1.9 | 实现速度控制（1×/2×/4×/8×） | 变速 | 30min |
| 1.10 | 实现进度条拖拽跳转 | 进度条 | 1h |
| 1.11 | 实现自动滚动 + 当前节点高亮 | 视觉跟随 | 1h |
| 1.12 | 实现键盘快捷键 | 快捷键 | 45min |
|      | → Space: play/pause | | |
|      | → ←/→: 上/下一个 node | | |
|      | → j/k: 上/下一个 exploration | | |

**Day 3 交付物**: 点击 Play 后自动播放时间线，支持变速和跳转。

### Day 4: 搜索 + 优化

| # | 任务 | 输出 | 预估 |
|---|------|------|------|
| 1.13 | 实现全文搜索（工具名、文件路径、内容） | 搜索框 | 1.5h |
| 1.14 | 搜索结果高亮 + 过滤时间线 | 搜索 UI | 1h |
| 1.15 | detail 字段截断策略（默认 2000 字符） | 体积优化 | 30min |
| 1.16 | `--strip-thinking` 选项实现 | CLI 选项 | 30min |
| 1.17 | `--max-detail-length` 选项实现 | CLI 选项 | 20min |
| 1.18 | `--with-summaries` 从缓存读取 AI 摘要 | 摘要集成 | 1h |

**Day 4 交付物**: 搜索可用，体积可控。

### Day 5: 集成 + 测试

| # | 任务 | 输出 | 预估 |
|---|------|------|------|
| 1.19 | TUI 快捷键 `e` — 在 Observer 中一键导出 | TUI 集成 | 1h |
| 1.20 | 导出完成后通过通知系统推送 | 通知集成 | 45min |
| 1.21 | 用 3 个真实 session 测试（短/中/长） | 测试 | 1h |
| 1.22 | 跨浏览器验证（Chrome / Firefox / Safari） | 兼容性 | 30min |
| 1.23 | 移动端验证（Chrome Mobile） | 响应式 | 30min |
| 1.24 | 体积报告：确认 30min session < 500KB | 性能 | 20min |

**Week 1 交付物**: 🎬 **Session Replay MVP 发布**

---

## 🎨 Phase 2: Theme Playground + Replay 增强（Week 2 前半）

> **目标**: 主题在线预览页 + Replay 接入全部 30 种主题

### Day 6-7: Theme Playground

| # | 任务 | 输出 | 预估 |
|---|------|------|------|
| 2.1 | 创建 `scheme/src/export/theme-playground/` | 目录 | 10min |
| 2.2 | 实现 `generate-playground.ts` — 读取所有主题数据 | 数据提取 | 1h |
| 2.3 | 实现 Playground HTML 模板 | 模板 | 2h |
|     | → 左侧：主题列表（30 种，分类显示） | | |
|     | → 右侧：模拟 TUI 预览区（仿真终端渲染） | | |
|     | → 底部：配色详情（颜色值 + 色块） | | |
| 2.4 | 实现实时切换：点击主题 → CSS Variables 即时变化 | 切换逻辑 | 1h |
| 2.5 | 实现调色板编辑器 | 编辑器 | 2h |
|     | → 每个颜色值可点击弹出 color picker | | |
|     | → 修改后实时预览 | | |
|     | → 「导出 TypeScript」按钮 → 生成 ColorScheme 代码 | | |
| 2.6 | CLI 集成：`bun run src/main.ts --theme-playground -o themes.html` | CLI | 30min |
| 2.7 | 可选：部署到 GitHub Pages 的 CI 脚本 | 部署 | 1h |

### Day 8: Replay 主题系统对接

| # | 任务 | 输出 | 预估 |
|---|------|------|------|
| 2.8 | 实现 `theme-to-css.ts` — ColorScheme → CSS Variables 转换 | 转换器 | 45min |
| 2.9 | Replay HTML 内嵌主题选择器（右上角下拉菜单） | 主题切换 | 1.5h |
|     | → 30 种主题全部可选 | | |
|     | → 切换即时生效（无需重新生成） | | |
| 2.10 | 所有主题数据内联到 HTML（约 +5KB） | 数据内联 | 30min |
| 2.11 | `FLOW_THEME` 环境变量指定默认主题 | 配置 | 20min |

**Week 2 前半交付物**: 🎨 Theme Playground 页面 + Replay 支持全部主题

---

## 🌐 Phase 3: Web Mirror（Week 2 后半 + Week 3 前半）

> **目标**: Observer 状态实时投射到浏览器

### Day 9-10: 架构搭建

| # | 任务 | 输出 | 预估 |
|---|------|------|------|
| 3.1 | 在现有 `server.ts` 基础上添加 WebSocket 支持 | WS 服务 | 2h |
|     | → 使用 Bun 原生 WebSocket（无额外依赖） | | |
|     | → 连接管理：多客户端、心跳检测 | | |
| 3.2 | 定义实时推送数据协议 | 协议 | 1h |
|     | → `type: 'snapshot'` — 全量状态（首次连接时） | | |
|     | → `type: 'node_added'` — 增量节点 | | |
|     | → `type: 'phase_change'` — 阶段切换 | | |
|     | → `type: 'stats_update'` — 统计更新 | | |
|     | → `type: 'exploration_start'` — 新 exploration | | |
| 3.3 | Observer state 变化 → WebSocket 广播 | 广播逻辑 | 1.5h |
|     | → hook 到 `useSessionPolling` 的 state 变化 | | |
|     | → 增量 diff 推送（不重传全量） | | |
| 3.4 | CLI 集成：`--web-mirror` 标志 | CLI | 30min |
|     | → 启动 Observer 时同时启动 WebSocket server | | |
|     | → 打印本机 IP + 端口供手机访问 | | |

### Day 11-12: Web 前端

| # | 任务 | 输出 | 预估 |
|---|------|------|------|
| 3.5 | Web Mirror 前端页面实现 | HTML/JS | 3h |
|     | → 复用 Replay 的布局和样式 | | |
|     | → 实时更新：新 node 自动出现在时间线 | | |
|     | → 当前 Phase 状态指示器（大号图标） | | |
|     | → 统计数字实时跳动 | | |
| 3.6 | 实时进度条（基于 exploration 完成度） | 进度条 | 1h |
| 3.7 | 移动端优化 | 响应式 | 1.5h |
|     | → 单栏布局（时间线在上，详情在下） | | |
|     | → 触摸友好的大按钮 | | |
|     | → 自动滚动到最新 node | | |
| 3.8 | 连接状态显示 | 状态 UI | 30min |
|     | → 🟢 已连接 / 🔴 断开 / 🟡 重连中 | | |
|     | → 自动重连机制 | | |

### Day 13: 增强功能

| # | 任务 | 输出 | 预估 |
|---|------|------|------|
| 3.9 | Token 消耗实时曲线（inline SVG） | 图表 | 2h |
| 3.10 | 文件热力图（哪些文件被频繁访问） | 可视化 | 1.5h |
| 3.11 | 通知入口：收到微信通知 → 点击打开 Web Mirror | 联动 | 1h |
| 3.12 | `flow-run.sh` 集成 `--web-mirror` 选项 | 脚本 | 30min |

**Week 2-3 交付物**: 🌐 Web Mirror v1.0 — 手机可实时看 Flow 进度

---

## 📊 Phase 4: Knowledge Graph（Week 3 后半）

> **目标**: Wiki 知识条目的可视化图谱

### Day 14-15: 图谱实现

| # | 任务 | 输出 | 预估 |
|---|------|------|------|
| 4.1 | 创建 `scheme/src/export/knowledge-graph/` | 目录 | 10min |
| 4.2 | 实现知识数据提取 | 数据层 | 1.5h |
|     | → 读取 `~/.flow-wiki/` 所有条目 | | |
|     | → 提取：title, tags, timestamp, type | | |
|     | → 构建节点 + 边（相同 tag = 连线） | | |
| 4.3 | 选择渲染库并嵌入 | 依赖 | 30min |
|     | → 方案 A: D3.js force layout（功能强，~90KB） | | |
|     | → 方案 B: vis-network（开箱即用，~50KB） | | |
|     | → 方案 C: 自研简易 force（极轻量，~5KB） | | |
|     | → **推荐方案 A**（内联 minified D3） | | |
| 4.4 | 图谱 HTML 实现 | 前端 | 3h |
|     | → Force-directed layout 物理模拟 | | |
|     | → 节点着色：按 type 分色（error=红, snippet=蓝, decision=紫...） | | |
|     | → 节点大小：按关联数量缩放 | | |
|     | → 边粗细：按共享 tag 数量 | | |
|     | → Zoom / Pan 交互 | | |
| 4.5 | 交互功能 | 交互 | 2h |
|     | → 点击节点 → 弹出详情卡片 | | |
|     | → 搜索框 → 高亮匹配节点 | | |
|     | → 筛选器：按 type / tag / 时间范围 | | |
| 4.6 | CLI 集成：`bun run src/main.ts --knowledge-graph -o graph.html` | CLI | 30min |

**Week 3 后半交付物**: 📊 Knowledge Graph 页面可用

---

## 🔥 Phase 5: Live Stream 模式（远期 / 按需）

> **目标**: 适合 OBS 捕获的美观直播页面

### 任务列表（不定工期）

| # | 任务 | 说明 |
|---|------|------|
| 5.1 | OBS 优化布局 | 固定 1920×1080，高对比度，大字体 |
| 5.2 | 代码打字机动画 | response 文本逐字出现效果 |
| 5.3 | Phase 切换过渡动画 | explore→execute→verify 带流畅动效 |
| 5.4 | 工具调用动画 | 工具图标弹出 + 文件路径飞入 |
| 5.5 | 背景粒子/波浪效果 | 视觉氛围（可选，不影响可读性） |
| 5.6 | 摄像头叠加区域 | 预留右下角透明区给主播头像 |
| 5.7 | 自定义水印/Logo | 品牌展示 |

---

## 🏗️ 技术规范

### 共享原则

| 原则 | 说明 |
|------|------|
| 单文件自包含 | 每个 HTML 输出都是零外部依赖的 |
| Vanilla JS 优先 | 不引入 React/Vue/Svelte（保证单文件 + 长期可维护） |
| 主题统一 | 所有 HTML 产物复用同一套 CSS Variables 主题体系 |
| 渐进增强 | 基础功能不依赖 JS（静态时间线），JS 增强交互 |
| 隐私安全 | 默认脱敏（路径→相对路径，token/secret→[REDACTED]） |

### 目录规划

```
scheme/src/export/
├── index.ts                     # 统一导出入口
├── shared/                      # 共享模块
│   ├── theme-to-css.ts          # 主题 → CSS Variables
│   ├── sanitize.ts              # 隐私脱敏工具
│   └── html-utils.ts            # HTML 转义、模板填充
├── html-replay/                 # Phase 1: Session Replay
│   ├── export-html.ts
│   ├── template.ts
│   ├── styles.ts
│   ├── player.ts
│   └── types.ts
├── theme-playground/            # Phase 2: Theme Playground
│   ├── generate-playground.ts
│   ├── template.ts
│   └── editor.ts
├── web-mirror/                  # Phase 3: Web Mirror
│   ├── ws-server.ts
│   ├── protocol.ts
│   ├── client-page.ts
│   └── realtime-charts.ts
└── knowledge-graph/             # Phase 4: Knowledge Graph
    ├── generate-graph.ts
    ├── template.ts
    └── force-layout.ts
```

### CLI 命令汇总

```bash
# Session Replay
bun run src/main.ts --export-html -o replay.html
bun run src/main.ts --export-html --session-id abc123 --with-summaries
bun run src/main.ts --export-html --strip-thinking --max-detail-length 500

# Theme Playground
bun run src/main.ts --theme-playground -o themes.html

# Web Mirror
bun run src/main.ts --web-mirror                    # 启动实时服务
bun run src/main.ts --web-mirror --port 8080        # 指定端口

# Knowledge Graph
bun run src/main.ts --knowledge-graph -o graph.html
bun run src/main.ts --knowledge-graph --since 7d    # 只看 7 天窗口
```

### TUI 快捷键新增

| 键 | 功能 | Phase |
|----|------|-------|
| `e` | 导出当前 session 为 Replay HTML | Phase 1 |
| `E` | 导出并用默认浏览器打开 | Phase 1 |
| `W` | 启动/停止 Web Mirror | Phase 3 |

---

## 📊 里程碑 & 验收标准

### M1: Session Replay MVP（Week 1 结束）

- [ ] `--export-html` 命令可正常执行
- [ ] 输出的 HTML 在 Chrome / Firefox / Safari 正常打开
- [ ] 时间线显示所有 explorations 和 nodes
- [ ] 点击 node 可查看详情
- [ ] Play/Pause/变速/跳转功能正常
- [ ] 搜索可过滤时间线
- [ ] 30min session HTML < 500KB
- [ ] 不含外部网络请求
- [ ] 不泄露敏感信息

### M2: Theme System（Week 2 中期）

- [ ] Theme Playground 页面可打开
- [ ] 30 种主题全部可预览
- [ ] 调色板编辑器可修改颜色并实时预览
- [ ] 导出的 TypeScript 代码可直接粘贴使用
- [ ] Replay HTML 内嵌主题切换器

### M3: Web Mirror v1（Week 3 前期）

- [ ] `--web-mirror` 启动 WebSocket 服务
- [ ] 浏览器连接后实时显示 Flow 状态
- [ ] 新增 node 自动出现（<1s 延迟）
- [ ] 手机端可正常访问和交互
- [ ] 支持多客户端同时连接
- [ ] 断线自动重连

### M4: Knowledge Graph（Week 3 末）

- [ ] 图谱正确渲染所有知识节点
- [ ] 相同 tag 的节点有连线
- [ ] 支持 zoom/pan/点击查看详情
- [ ] 支持按 type/tag 筛选

---

## ⚠️ 风险 & 对策

| 风险 | 影响 | 对策 |
|------|------|------|
| HTML 文件体积过大（>1MB） | 分发不便 | detail 截断 + strip-thinking + 压缩 |
| 播放引擎在长 session 中卡顿 | 体验差 | 虚拟化列表 / 只渲染可视区 |
| WebSocket 在弱网下不稳定 | Mirror 断连 | 自动重连 + 离线缓冲 |
| D3.js 体积太大 | 单文件膨胀 | tree-shake + 只用 force 模块 |
| 不同 session JSONL 格式差异 | 解析失败 | 基于现有 parser 的容错设计 |

---

## 👥 分工建议

| 角色 | 负责 |
|------|------|
| **开发者 A** | Session Replay 全栈（数据层 + 前端 + CLI） |
| **开发者 B** | Web Mirror（WebSocket + 实时前端） |
| **设计 / 前端** | Theme Playground + 视觉打磨 + Live Stream 动画 |
| **全员** | Knowledge Graph（轻量，可作为 hackathon 项目） |

如果只有 1 人：按 Phase 顺序推进，每个 Phase 完成后发布可用版本。

---

## 🎯 Quick Win（最快可执行路径）

最快可执行路径：

```bash
# 1. 创建最小 HTML 导出（~2h）
#    - 读取 session JSONL
#    - 提取 explorations
#    - 生成一个带样式的静态 HTML（无播放器）
#    - 双击打开验证

# 2. 发到群里让大家体验

# 3. 收集反馈，迭代
```

先有一个能跑的东西，再逐步加功能。**船到码头自然直**。

---

*文档结束。开始干活吧！🚀*
