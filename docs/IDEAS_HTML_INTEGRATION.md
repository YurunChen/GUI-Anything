# 🌊 GUI-Anything × HTML — 创意提案

> ⚠️ **部分取代（2026-06-20）**：`--export-html` 已从「Session Replay 回放」改为
> 「项目功能演进史」（intent 演进可视化，`scheme/src/export/evolution/`）。本提案的回放方向已落地为该形态；其余创意仍有效。

> TUI 做「心流观察」是极佳的本地体验；HTML 可以补足 TUI 天然做不到的事。
> 以下是 5 个将 HTML 与我们项目结合的方向，按「好玩 → 实用」排序。

---

## 🎬 1. Session Replay — 单 HTML 文件回放

**一句话：** 把一次 Flow session 导出为一个自包含 HTML，双击打开，就能完整回放 Claude 的思考与操作过程。

```
┌─────────────────────────────────────────────────┐
│  [▶ Play] [⏸] ──●────────── 15:32 / 45:00     │
├─────────────────────────────────────────────────┤
│  Timeline         │  Detail Panel               │
│  ┌──────────┐     │  📝 Tool: edit_file         │
│  │ thinking │     │  📁 src/auth.ts             │
│  │ tool_use │◄── │  ```diff                     │
│  │ thinking │     │  - old code                  │
│  │ result   │     │  + new code                  │
│  │ ...      │     │  ```                         │
│  └──────────┘     │                             │
├─────────────────────────────────────────────────┤
│  📊 Stats: 67 tools | 12 files | 3 errors      │
└─────────────────────────────────────────────────┘
```

**为什么好玩：**

- **零部署分发** — 双击 `.html` 就能看，直接发群 / 贴博客 / 邮件附件
- **结构化回放** — 不是终端录屏，是可搜索、可跳转、可变速的结构化数据
- **知识锚点** — Wiki 提取的知识点作为「高亮标记」出现在时间线上
- **Mermaid 图表** — 可选嵌入文件依赖关系变化图

**技术切入点：**

- 我们已有 JSONL session 数据 + `extractExplorationsFromSession` 解析器
- 解析 → 嵌入 `<script type="application/json">` → Vanilla JS 渲染
- 导出命令：`bun run src/main.ts --export-html > replay.html`
- 目标体积：30 分钟 session ≈ 200KB HTML（gzip < 50KB）

**和项目哲学的契合：** 完美对齐「沉淀态 Capture」——从实时体验到可传递的知识制品。

---

## 🌐 2. Web Mirror — TUI 的远程「影子」

**一句话：** WebSocket 实时投射 Observer 状态到浏览器，手机上也能看 Flow 进度。

```bash
./scripts/flow-run.sh --web-mirror
# 手机打开 http://192.168.x.x:3000 即可围观
```

**为什么好玩：**

- **移动端看板** — 跑长任务时掏出手机看进度，配合通知系统成为「看详情」的入口
- **团队围观** — 多人只读观看同一个 session，像看直播
- **超越 TUI 的可视化** — 热力图、文件树可视化、token 消耗曲线……浏览器做这些毫无压力

**和现有架构的结合：**

- 已有 `--web` 模式（HTTP server at :3000），在此基础上加 WebSocket 推送
- Observer 的 state 本身就是 React state，做一层序列化广播即可
- 前端可以用轻量框架（Preact/Vanilla）避免引入重依赖

---

## 🎨 3. Theme Playground — 主题在线预览 / 编辑器

**一句话：** 一个 HTML 页面，实时预览全部 30 种主题效果，还能可视化编辑自定义配色。

**为什么好玩：**

- **所见即所得** — 模拟 TUI 的 ANSI 渲染效果，拖拽调色板实时变化
- **一键导出** — 选好颜色 → 自动生成 `ColorScheme` TypeScript 代码 → 复制粘贴即用
- **社区友好** — 降低贡献主题的门槛，不需要在终端里反复 trial-and-error

**技术切入点：**

- 读取 `themes/index.ts` 的配色数据，生成静态 HTML 预览页
- 用 CSS Custom Properties 实现实时切换
- 可作为 GitHub Pages 部署，成为项目的「门面」

---

## 📊 4. Knowledge Graph — Wiki 知识的可交互图谱

**一句话：** 把 Wiki 系统积累的知识条目渲染为一个 force-directed 图谱，发现隐藏关联。

**为什么好玩：**

- **全景图** — 跑了几十个 session 后，一眼看到知识积累的全貌
- **隐藏关联** — 相同 tag 连线，发现意想不到的知识关系
- **交互探索** — zoom / pan / 点击展开详情，比纯文本列表有趣 100 倍

**技术切入点：**

- 数据源：`~/.flow-wiki/` 下的知识条目 JSON
- 渲染：D3.js force layout 或更轻量的 vis-network（~50KB）
- 可作为 `--posthoc` 模式的增强输出，或独立的 `--knowledge-graph` 命令

---

## 🔥 5. Live Coding Stream — AI 编程直播模式

**一句话：** 把 Flow session 变成可直播的精美 HTML 页面，OBS 捕获即开播。

**为什么好玩：**

- **AI Coding 观赏版** — 美观的代码变更动画、实时进度条、状态流转
- **内容创作** — 录制「Claude 如何从零搭建一个项目」的视频素材
- **教学场景** — 展示 AI 辅助编程的真实工作流

**技术切入点：**

- 在 Web Mirror 基础上加动画层：代码打字机效果、phase 切换过渡
- 针对 OBS 优化：固定分辨率、高对比度文字、关键操作放大

---

## 📋 优先级矩阵

| 方向 | 复杂度 | 好玩度 | 实用性 | 建议 |
|------|:------:|:------:|:------:|:----:|
| 🎬 Session Replay | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | **🥇 首选** |
| 🌐 Web Mirror | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 🥈 次选 |
| 📊 Knowledge Graph | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | 🥉 可并行 |
| 🎨 Theme Playground | ⭐ | ⭐⭐⭐ | ⭐⭐ | 周末小项目 |
| 🔥 Live Stream | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | 远期探索 |

---

## 💡 为什么 Session Replay 是最佳切入点

1. **哲学对齐** — 「沉淀态 Capture」的自然延伸：从实时观察 → 可传递的知识制品
2. **复用最大化** — 现有的 JSONL 解析器、Exploration 提取器、主题系统全部复用
3. **传播潜力** — 单文件 HTML = 最低分发成本 = 最容易在社区扩散
4. **渐进迭代** — 先做静态时间线（1天）→ 加播放器（1天）→ 加搜索和主题（1天）

一旦 Replay 做好，Web Mirror 就是把「离线回放」变成「在线直播」的自然进化。

---

## 🚀 下一步

Session Replay 的完整技术方案已就绪（见 `docs/SESSION_REPLAY_HTML_RFC.md`），核心决策：

- **单文件自包含**：CSS + JS + 数据全部 inline，零外部依赖
- **Vanilla JS**：不引入框架，保证轻量和长期可维护性
- **主题系统复用**：30 种主题通过 CSS Variables 注入
- **播放引擎**：`requestAnimationFrame` 驱动，支持 1×-8× 变速
- **CLI 集成**：`bun run src/main.ts --export-html -o replay.html`
- **TUI 集成**：在 Observer 中按 `e` 键一键导出

预估工期：**3.5 - 4.5 天**（MVP 可在 1-2 天内跑通）。

---

*Let's build something fun. 🌊*