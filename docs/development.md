# GUI-Anything 开发指南

> **读者**：在本仓库协作的开发者、Reviewer、AI Agent。  
> **分工**：`README.md` = 对外安装与 Quick Start · `AGENTS.md` = Agent 红线与速查 · **本文** = 协作方式 + 架构规范 + 扩展手册 · `docs/data-governance/` = 数据流与 UI 细则。

---

## 1. 协作开发

### 1.1 新人 5 分钟

```bash
./scripts/setup.sh
cd scheme && bun install
cd scheme && bun test && bunx tsc --noEmit
ga doctor && ga flow
```

右栏单独调试：

```bash
cd scheme
FLOW_PROJECT_DIR=/path/to/repo FLOW_SESSION_ID=<uuid> bun run start:live
```

### 1.2 日常开发循环

```
1. 读需求 → 确定改动落在哪一层（§2、§4）
2. 改 scheme/src/（必要时 scripts/、skills/）
3. 验证：bun test · tsc · ga flow 手测
4. 按 §1.4 同步 docs/ · README · AGENTS.md
5. PR：说明行为变化 + 测了什么
```

**Definition of Done**

- [ ] 行为有测试或说明为何不测
- [ ] `bun test` + `tsc --noEmit` 通过
- [ ] 未违反 §2 架构宪法
- [ ] 相关 `docs/` 已更新（或确认无需更新）
- [ ] 新 `FLOW_*` 已写入 `flow-run.sh --help` 与 §5.2

### 1.3 协作约定

| 主题 | 约定 |
|------|------|
| **改动范围** | 一次 PR 只做一件事；不顺便重构无关模块 |
| **分层** | 不为了「快」在 UI 里 `fs`、不复制 session binding 分支 |
| **策略单点** | Resume/摘要/wiki 门禁各只有一个权威模块（§2.3） |
| **类型与协议** | 跨层形状放 `data/protocol/`；禁止 UI 与 service 各定义一套 |
| **环境开关** | 行为差异用 `FLOW_*` env，默认值与文档一致 |
| **Review 重点** | 依赖方向、是否有重复策略、测试、文档是否同步 |
| **运行时数据** | `wiki/` **不提交**；知识条目用 Agent/CLI 生成 |

### 1.4 文档写在哪里

**原则：设计、数据流、运维细节进 `docs/`；根目录保持短。**

| 类型 | 路径 | 何时改 |
|------|------|--------|
| 开发总指南 | `docs/development.md` | 协作规范、架构、扩展方式 |
| 数据 / UI 治理 | `docs/data-governance/` | repository、Wiki 链路、展示策略 |
| 协议 RFC | `docs/protocols/` | 跨进程契约变更 |
| 功能 runbook | `docs/NOTIFICATION.md`、`docs/THEMES.md` 等 | 部署、env、故障排查 |
| 脚本 CLI | `scripts/wiki/README.md` 等 | 新 flag / env |
| Skill | `skills/<name>/SKILL.md` | Agent 行为 |
| 对外 | `README.md` | 用户可见命令 |
| Agent 协作约定 | `AGENTS.md` | 原则、红线、误解表；**不贴长文**，细节在本文 |
| 历史计划 | `docs/plans/`、`*RFC*` | 可归档；**现行以代码 + 本文为准** |

```
docs/
├── development.md           ← 本文
├── release-checklist.md
├── data-governance/         ← data-flow · ui-layer-rules · display-policy
├── protocols/
├── NOTIFICATION*.md · THEMES.md
└── plans/                   ← 可能过期
```

**改代码 → 文档同步（最小集）**

| 改了… | 至少更新… |
|-------|-----------|
| UI / chrome | 本文 §8；必要时 [ui-layer-rules.md](data-governance/ui-layer-rules.md) |
| Session / `FLOW_*` | 本文 §5.1–5.2、`README.md`、`AGENTS.md` |
| Wiki 检索 / 策展 | [data-flow.md](data-governance/data-flow.md)、本文 §6 |
| 新 repository | [data-management.md](data-governance/data-management.md)、`wiki-data-layout.ts` |
| 对外命令 | `README.md` + 本文 |

---

## 2. 架构宪法

争议时以本节为准。细则见 [ui-layer-rules.md](data-governance/ui-layer-rules.md)、[data-flow.md](data-governance/data-flow.md)。

### 2.1 分层与依赖

```
scripts/flow-run.sh          进程编排、env 注入
        ↓
scheme/src/app/              hooks 接线 + UI（OpenTUI）
        ↓
scheme/src/services/         AI、session、wiki 编排（无 UI）
        ↓
scheme/src/data/             protocol、repository、env（可 fs）
        ↓ 只读
~/.claude/projects/*.jsonl     Claude 会话真相源
```

| 层 | 可依赖 | 禁止 |
|----|--------|------|
| `app/ui/flow/**` | `data/protocol`（类型）、view-model props、`theme`、`constants` | `services/*`、repository、`fs` |
| `app/observer/hooks/**` | `services/*`、`data/protocol`、`constants` | 在 UI 组件里写业务 |
| `app/observer/view-model/**` | `data/protocol`、`domain/*`、`constants` | services、OpenTUI、repository |
| `services/**` | `data/*`、`domain/*`、`constants`、`utils` | React / OpenTUI |
| `data/**` | `protocol`、`domain`、`utils`、`node:fs` | `app/*`、`services/*` |

**新增持久化**：`data/` repository → `services/` 编排 → `app/observer/hooks/` → UI。**禁止** UI 直接写 wiki。

### 2.2 单一真相源

| Concern | 权威模块 | 不要重复实现于 |
|---------|----------|----------------|
| Session 绑定 | `services/session/session-binding-policy.ts` | shell、UI、hooks |
| Live / Replay 展示 | `services/session/session-runtime-policy.ts` | 卡片组件 |
| 摘要档位 | `data/protocol/summary-contract.ts` + [display-policy.md](data-governance/display-policy.md) | 多套 summary map |
| Flowchart intent badge | `data/protocol/flowchart-intent.ts`（只用 `intent_key`） | 用 `node_id` 当 badge |
| Intent 词表 | `constants/session-intent-keys.ts` | 字符串散落 |
| Wiki 策展门禁 | `shouldCurateWikiForIntent()` · `isSummaryReadyForWiki()` | UI 自行判断 |
| Session bundle（应用层） | `session-bundle-service.ts`（`getSessionBundleRepository`） | data 层外直连 `defaultSessionBundleRepository` |
| 摘要编排 | `summary-orchestrator.ts` + `exploration-summary-service.ts` | hook 内重复 hydrate/generate 逻辑 |
| Prior KNOWLEDGE + bundle retrieval | `wiki-retrieval-policy.ts` · `exploration-card-pipeline.ts` · `SessionBundleService` | 各写一套 search/patch；勿用 `matchWikiForExploration`（Observer） |
| Wiki 路径 | `data/wiki/wiki-data-layout.ts` + `resolveWikiRoot()` | 硬编码路径 |
| JSONL 解析 | `data/session/jsonl-session.ts` | legacy `posthoc.ts` |

### 2.3 策略集中点

- **Launcher** 只映射 CLI → `FLOW_*`；语义由 TypeScript 策略消费。
- **Resume 不 regen 摘要**：只在 `session-binding-policy` + `session-runtime-policy` 决定，UI 只读 props。
- **Wiki 检索 vs 落盘**：两条独立链路（见 [data-flow.md](data-governance/data-flow.md)）；KNOWLEDGE 卡片 ≠ wiki write badge。

### 2.4 UI 规范（摘要）

- 编排唯一入口：`LiveObserverContainer.tsx` → `shell-props.ts` → `FlowObserverShell.tsx`。
- 叶子组件 prop-driven；chrome 类型在 `shell-chrome.types.ts`。
- 主题用 `semantic.*`（`app/ui/theme.ts`）；文案用 `observer-messages.ts`（`FLOW_LOCALE=zh-Hans` 仅 chrome）。

### 2.5 已知例外（勿扩散）

| 位置 | 说明 |
|------|------|
| `services/session/posthoc.ts` | 仅 re-export `data/session/*`，新代码勿用 |
| `services/ai/summary-cache.ts` | 仅 re-export summary repository |
| `FLOW_WIKI_LEGACY_PER_TURN=1` | 恢复每 exploration 落盘（对比用） |

---

## 3. 系统概览

### 3.1 产品边界

GUI-Anything = **旁路 Observer**：左 Claude Code，右屏实时读 JSONL、写派生数据到 `wiki/`。**不驱动** Claude 执行。

解决：结构化观察 · 可复用沉淀 · 可预期 resume（`-r` 严格回放、不重算摘要）。

### 3.2 Run / Capture / Guide

| 层 | 职责 | 主路径 |
|----|------|--------|
| **Run** | exploration、phase、工具/错误 | `useSessionPolling` → `ExplorationCard` |
| **Capture** | 摘要、flowchart、intent bucket、Wiki | `useExplorationSummaries` + `useWikiCurator` |
| **Guide** | prior wiki、Focus | `useWikiMatches` + `FocusView` |

设计原则：**心流**（不打扰左屏）· **按需知识**（pivot 才策展）· **无感使用**（`ga flow` 一键）。

### 3.3 能力矩阵

| 能力 | 入口 / 代码 |
|------|-------------|
| 双栏 Flow | `ga flow` → `scripts/flow-run.sh` |
| Live / Continue / Resume | `FLOW_RESUME_MODE` · `session-binding-policy.ts` |
| AI 摘要 + flowchart | `flow-summaries.ts` · `useExplorationSummaries` |
| Intent 词表 + pivot | `session-intent-keys.ts` |
| Focus（当前意图 + 紧凑轨迹） | `session-flow-projector.ts` · `focus-guide-view.ts` · `FocusView.tsx` |
| Wiki prior 检索 | `match-service.ts` · KNOWLEDGE 卡片 |
| Wiki intent 策展 | `useWikiCurator` · `wiki-curation-runtime.ts` · `wiki-curator-service.ts` · `/llm-wiki` |
| Wiki 维护 Phase 2 | `scripts/wiki/wiki-maintain.sh` |
| 灵感笔记 | `NotesSidePanel` · `note-repository.ts` |
| 图缓存 / digest | `useGraphSnapshot` · `graph-consolidation-service.ts` |
| 主题 / i18n | `themes/` · `FLOW_LOCALE` |
| 通知 | `useNotification` · [NOTIFICATION.md](NOTIFICATION.md) |
| HTML replay / mirror / graph | `scheme/src/export/` · `main.ts` flags |

### 3.4 延伸阅读

| 文档 | 内容 |
|------|------|
| [data-flow.md](data-governance/data-flow.md) | Wiki 时序、决策树、存储分工 |
| [display-policy.md](data-governance/display-policy.md) | Live/Replay、摘要 L0–L4 |
| [data-management.md](data-governance/data-management.md) | Repository 映射 |
| [ui-layer-rules.md](data-governance/ui-layer-rules.md) | Import 边界 |
| [scripts/wiki/README.md](../scripts/wiki/README.md) | Wiki CLI |
| [release-checklist.md](release-checklist.md) | 发包 |

---

## 4. 代码组织

### 4.1 仓库目录

| 路径 | Git | 用途 |
|------|-----|------|
| `scheme/src/` | ✅ | 主代码 |
| `scripts/` | ✅ | `flow-run.sh`、wiki 脚本 |
| `cli/` | ✅ | `ga` |
| `skills/` | ✅ | llm-wiki 等 |
| `docs/` | ✅ | 设计与 runbook |
| `wiki/` | ❌ | 本地知识库（`FLOW_ROOT_DIR/wiki`） |
| `.flow-runtime/` | ❌ | Zellij layout 等 |

### 4.2 scheme 模块速查

**Data**（`scheme/src/data/`）

| 模块 | 职责 |
|------|------|
| `protocol/observer-protocol.ts` | 跨层 ID、Exploration、图类型 |
| `protocol/flowchart-intent.ts` | badge 用 `intent_key`；`node_id` 仅树 |
| `protocol/summary-contract.ts` | `SummaryItem` 唯一形状 |
| `session/claude-project.ts` | JSONL 路径发现 |
| `session/jsonl-session.ts` | 解析、exploration 提取 |
| `wiki/*-repository.ts` | 文件 CRUD |
| `wiki/wiki-data-layout.ts` | 三链路径常量 |

**Services**（`scheme/src/services/`）

| 模块 | 职责 |
|------|------|
| `session/session-binding-policy.ts` | Binding、visibility、allowRegen |
| `session/session-runtime-policy.ts` | Live/replay phase（authoritative） |
| `session/session-banner.ts` | Replay banner copy |
| `session/session-bundle-service.ts` | 应用层 facade（`getSessionBundleRepository` · `ensureExplorationRetrieval`） |
| `session/exploration-card-pipeline.ts` | Live card order: retrieval → summary |
| `session/observer-session-service.ts` | JSONL 轮询 |
| `ai/exploration-summary-service.ts` | 摘要 hydrate/generate |
| `ai/summary-orchestrator.ts` | Hydrate / generate scheduling（非 React） |
| `wiki/wiki-curator-service.ts` | Intent digest + Wiki Agent |
| `wiki/intent-bucket-service.ts` | intent-buckets.json |
| `wiki/match-service.ts` | Prior 检索 |
| `wiki/wiki-retrieval-policy.ts` | 检索 query、prior 过滤、`ensureExplorationRetrieval`（bundle `retrieval` 读写） |
| `wiki/wiki-agent/` · `wiki-maintain-agent/` | Phase 1 / 2 Agent |

### 4.3 Observer 组合

```
LiveObserverContainer
  ├── useSessionPolling
  ├── useExplorationSummaries   → SummaryOrchestrator → flowchartHints
  ├── useSessionIntent
  ├── useWikiCurator            → 策展 + 笔记
  ├── useGraphSnapshot / useGraphConsolidation
  ├── useNotification
  └── shell-props → FlowObserverShell → app/ui/flow/*
```

View-model（`app/observer/view-model/`）：`focus-guide-view`、`flow-graph-node-display`、`intent-chrome*`、`wiki-*-chrome`、`shell-props`、`exploration-card-view` — **无 IO**。

### 4.4 Intent 词表与 Wiki 策展

词表：`constants/session-intent-keys.ts`。Summary Agent 只能选表中 `intent_key`。

| `intent_key` | Wiki 策展（pivot/sweep） |
|--------------|-------------------------|
| explore, test_verify, general, greeting | ✗ |
| project_design, implement, refactor, debug, devops, research | ✓ |

覆盖：`FLOW_WIKI_CURATE_INTENTS=key1,key2`

---

## 5. 运行时

### 5.1 入口与 Session 模式

```
ga flow [-c|--continue] [-r|--resume [id]] [-m model] [prompt]
  → scripts/flow-run.sh → zellij → claude | bun run src/main.ts --live
```

| 命令 | `FLOW_RESUME_MODE` | Observer |
|------|-------------------|----------|
| `ga flow` | `bind_specific` + 新 UUID | live |
| `ga flow -c` / `-r <id>` | `continue` | wiki 有数据 → replay；无 → live 同步 Claude |
| `ga flow -c`（无 prior id） | `continue` | Claude `--continue`；observer 发现 jsonl 后 live 构建 |
| `ga flow -r` | `continue_picker` | picker 选中后同上 |

Shell **不实现** binding 分支；只设 `FLOW_*`。解析在 `session-discovery.ts`；**运行时单链**在 `session-runtime-policy.ts`（phase / visibility / summary / wiki search）。

**Continue 绑定优先级**（`ga flow -c`）：

1. `wiki/sessions/_index.json`（workspace 匹配 + jsonl 存在）
2. 扫描 `wiki/sessions/*/bundle.json`（最新 `meta.updatedAt`）
3. 最新 Claude jsonl（`findLatestSession`，须含 user turn）
4. 无 prior id 时 Claude 用 `--continue`，observer 用 `continue` 模式发现 jsonl 后 live 构建

`-c` / `-r` 运行时策略：`shouldReplayFromWiki` = continue 绑定 **且** `bundleHasDisplayData`；否则与 live 相同（regen、live wiki 检索、写 bundle）。

**Session bundle**（`wiki/sessions/{id}/bundle.json`）：聚合 summary、retrieval、write、flow、curation。须含 `meta.workspaceRoot`；JSONL 变新标记 stale 但不删 bundle。Restore/replay 不 regen；live 仅为缺 summary 调 AI。

Flow 图**仅**由 `useGraphSnapshot` 写入 `bundle.session.flow`。

### 5.2 环境变量

**Launcher → Observer**

| 变量 | 作用 |
|------|------|
| `FLOW_PROJECT_DIR` | 项目根（JSONL、observer cwd） |
| `FLOW_ROOT_DIR` | 仓库根（wiki 父路径） |
| `FLOW_SESSION_ID` | 绑定 session UUID |
| `FLOW_RESUME_MODE` | 见上表 |
| `FLOW_WIKI_DIR` | 覆盖 wiki 根 |
| `FLOW_LOCALE` | `zh-Hans` 本地化 chrome |
| `CLAUDE_MODEL` | Observer summary/wiki 模型；`ga flow --model` 会同步注入；未设置时继承 Claude CLI 默认 |
| `FLOW_SUMMARY_MODEL` | 覆盖 summary 子任务模型（优先于 `CLAUDE_MODEL`） |
| `FLOW_WIKI_MODEL` | 覆盖 Wiki Agent 模型（优先于 `CLAUDE_MODEL`） |
| `FLOW_WIKI_AGENT` | `0` 禁用 Wiki Agent |
| `FLOW_WIKI_CURATE_INTENTS` | 覆盖策展 intent 列表 |
| `FLOW_MIRROR_PORT` | Web Mirror 端口（默认 3000） |
| `FLOW_LOG_LEVEL` | Observer 日志级别：`debug` \| `info` \| `warn` \| `error`（默认 `info`） |
| `FLOW_LOG_MODULES` | 模块白名单，逗号分隔，如 `binding,session,summary,runtime` |
| `FLOW_LOG_FILE` | 日志落盘路径（默认 `logs/observer.log`，相对仓库根） |
| `FLOW_LOG_DISABLED` | `1` 时禁用文件落盘 |
| `FLOW_LOG_STDERR` | `1` 时同时输出 stderr（默认仅写 `logs/observer.log`，避免破坏 OpenTUI） |
| `FLOW_NOTIFY_WECHAT_USER_ID` | 启用微信通知并指定接收人 |
| `FLOW_NOTIFY_WECHAT_SERVICE_URL` | 微信本地服务地址（默认 `http://127.0.0.1:8765`） |
| `FLOW_NOTIFY_ENABLED` | `false` 禁用微信通知 |
| `FLOW_NOTIFY_ON_ERROR` | `false` 禁用错误告警 |
| `FLOW_NOTIFY_ON_KNOWLEDGE` | `false` 禁用知识提取通知 |
| `FLOW_NOTIFY_PROGRESS_INTERVAL` | 进度通知间隔分钟数，`0` 禁用 |
| `FLOW_NOTIFY_MIN_PRIORITY` | 最低通知优先级：`low` / `normal` / `high` / `urgent` |
| `FLOW_NOTIFY_QUIET_HOURS_*` | 免打扰配置：`ENABLED` / `START` / `END` |

完整列表：`./scripts/flow-run.sh --help`、`scripts/wiki/README.md`。

#### Debugging Flow

统一 logger：`scheme/src/utils/logger.ts`（`createLogger(module)`）。新代码勿用裸 `console.*`。

```bash
# flow-run 默认写入仓库 logs/observer.log
./scripts/flow-run.sh -c
tail -f logs/observer.log
grep 'f868caa6' logs/observer.log    # by session prefix
grep 'AI summary' logs/observer.log  # summary lifecycle

# 更详细
FLOW_LOG_LEVEL=debug FLOW_LOG_MODULES=binding,session,summary,runtime ./scripts/flow-run.sh -c
```

`reportError`（`utils/observability.ts`）仍保留分类与内存 metrics，输出走 `observer` 模块。

### 5.3 数据存储（三链）

无 SQL。详见 [data-management.md](data-governance/data-management.md)。

| 链 | 路径 | 说明 |
|----|------|------|
| Source | `~/.claude/projects/.../*.jsonl` | 只读 |
| Sessions | `wiki/sessions/_index.json` + `{id}/bundle.json` | 卡片快照、图、curation |
| Knowledge | `wiki/knowledge/**` | contexts / entities markdown |
| Notes | `wiki/notes/` | 用户灵感 |
| Runtime | `$TMPDIR/gui-anything-flow/layouts/` | Zellij KDL（临时） |

### 5.4 Launcher 运维

```bash
./scripts/flow-run.sh --cleanup
pgrep -fl 'flow-run|zellij.*flow-runtime'   # 关 tab 后应无残留
```

启动前清理其他 launcher PID；pane 用进程组便于退出时带走 claude + observer。

---

## 6. 核心链路（摘要）

细节与 mermaid 时序见 [data-flow.md](data-governance/data-flow.md)。

**会话**：`useSessionPolling` → `FileSessionRepository` → explorations + stats。

**摘要**：`useExplorationSummaries` → **`SummaryOrchestrator`** → hydrate `bundle.json` → Live 仅 `hasMissingSummaries` 时 `generateMissing`；展示层 `presentation-summaries.ts`（无 bundle IO）。标签 **cached** / **fallback** 见 `summary-provenance.ts` 与 [display-policy.md](data-governance/display-policy.md)。Restore/replay 不 `generateMissing`。

**Wiki 检索**：`exploration-card-pipeline` + `wiki-retrieval-policy.ensureExplorationRetrieval`（经 `SessionBundleService`）。`useWikiMatches` 与 `exploration-summary-service` 共用；顺序 **retrieval → summary**。Restore 禁用 live search。

**Flow 图**：`useGraphSnapshot` 唯一写入 `bundle.session.flow`（debounced）。

**Wiki 策展**：同 intent 内只积累 bucket → pivot 或 idle 30s sweep → `WikiCuratorService` + Agent → `contexts/`；badge 仅 anchor 轮。

**Focus**：`session-flow-projector` → `useGraphSnapshot`（缓存）→ `focus-guide-view` → `FocusView`（FOCUS header + compact trail）。

**HTML export**（独立 CLI，`cd scheme`）：

```bash
bun run src/main.ts --export-html -o replay.html
bun run src/main.ts --web-mirror --port 3001
bun run src/main.ts --knowledge-graph -o graph.html
```

Mirror 独立终端需手动 `FLOW_SESSION_ID` 与 flow 对齐。

---

## 7. 扩展手册

统一顺序：**protocol → data repository → services → view-model → hook → UI → docs**。

| 场景 | 步骤 |
|------|------|
| **新 UI 面板** | protocol 类型 → view-model chrome → hook → `ui/flow` → `LiveObserverContainer` / `shell-props` |
| **新 session 模式** | `session-binding-policy.ts` + `flow-run.sh` + display-policy 文档 |
| **新持久化** | `session-bundle-repository.ts` + `session-bundle-service.ts` → hook；更新 data-flow / display-policy |
| **新 intent_key** | `session-intent-keys.ts` → prompt catalog → `wiki-write-chrome` / `session-flow-projector` |
| **新 Focus 行为** | `session-flow-projector`（数据）· `focus-guide-view`（投影）· `FocusView`（渲染） |
| **新 Wiki 能力** | `wiki-agent/` 或 `wiki-maintain-agent/` + `skills/llm-wiki/` + data-flow |
| **新 export** | `scheme/src/export/` + `main.ts`；JSONL 用 `jsonl-session.ts` |
| **新通知渠道** | notification service + `useNotification` + `NOTIFICATION.md` |

每个场景补 colocated `*.test.ts`；改 env 则更新 §5.2 与脚本 help。

---

## 8. Observer UI 参考

| 区域 | 组件 | 要点 |
|------|------|------|
| 顶栏 | `ObserverStatusBar` | Timeline/Focus · token · errors · intent 标题（第 2 行） |
| 时间线 | `ExplorationCard` | 左 rail 轮次 · `[Intent] title` · status/tool meta · KNOWLEDGE soft panel · SUMMARY 自然高度 |
| Focus | `FocusView` | FOCUS header + compact intent trail |
| Workspace | `WorkspaceView` | 文件树 + 操作轨迹；视觉由 `modes.workspace` 控制 |
| 底栏 | `CommandBar` | 帮助打开时隐藏 |
| 笔记 | `NotesSidePanel`（`i`）· `InspirationPanel` | 侧栏灵感笔记 |
| 键盘 | `observer-key-dispatch.ts` | 聚焦 observer 窗格；`k` = audit |
| 主题 | `useTuiTheme()` · `resolved-theme.ts` | `palette → semantic → chrome → modes → motion`；组件优先读 mode token |

底部 personality：运行时不再展示 Buddy 动物绘图；`LiveObserverContainer` 只把当前 flow graph 命中的 coding-persona 类型传给 `PersonalityStrip`，在快捷键栏上方以 `Personality · CODE 名称 · TYPECODE` 的紧凑文本展示。HTML evolution export 仍保留完整 persona 卡片。

动态反馈保持统一、轻量：running turn 的 `Active` 与 SUMMARY loading 行复用同一个 Node/Ora 风格 spinner；summary 生成时 meta 行保持 turn 状态静态，避免上下两个 `Summarizing`。新卡片进入与 summary ready 只做一次短暂 accent，不做持续闪烁。真实百分比或步骤数明确时才使用 progress bar。节奏由 theme chrome 单点控制，避免每个组件各自动画；需要降低动态时可设 `FLOW_NO_ANIMATIONS=1`。

Calm（`c`）：默认全展开。Replay 摘要档位见 [display-policy.md](data-governance/display-policy.md)。

---

## 9. 验证与发布

```bash
cd scheme && bun test && bunx tsc --noEmit
ga doctor && ga flow   # 手测
```

**PR / 合并前**

- [ ] §2 架构宪法未违反
- [ ] 测试 + tsc 通过
- [ ] `docs/` / README / AGENTS 已按需同步（§1.4）
- [ ] 新 `FLOW_*` 已文档化
- [ ] §3.3 能力矩阵仍准确（若用户可见功能变了）

发包：[release-checklist.md](release-checklist.md)。
