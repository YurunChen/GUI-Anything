# GUI-Anything 开发指南

本文说明项目架构、数据存储模型，以及如何在此基础上扩展功能。与 `README.md`、`AGENTS.md` 保持同步；以 **代码为准** 时以 `scheme/src/` 与 `scripts/flow-run.sh` 为准。

## 1. 项目解决什么问题

Claude Code 擅长执行，但在长会话里缺少：

- **结构化观察**：当前在第几段 exploration、工具/错误概况
- **可复用沉淀**：摘要、flowchart、知识条目跨会话可读
- **可预期的恢复**：`-r` 严格回放，不误触发 AI 重算

GUI-Anything 是 **旁路 Observer**：左屏仍是 Claude Code，右屏 `scheme/` 实时展示并写入本地 `wiki/`。

## 2. 入口（已统一）

```
ga flow [--continue|-c] [--resume|-r [id]] [--model|-m MODEL] [--skip-doctor] [prompt...]
  └── scripts/flow-run.sh
        └── zellij --layout <generated.kdl> attach --create <session> options --on-force-close quit
              ├── claude (left)
              └── FLOW_* env + bun run src/main.ts --live (right)
```

| 命令 | Launcher 行为 | `FLOW_RESUME_MODE` | `FLOW_SESSION_ID` | Summary |
|------|---------------|-------------------|-------------------|---------|
| `ga flow` | 新 UUID + `claude --session-id` | `bind_specific` | 新 UUID | 可 regen |
| `ga flow --continue`（从 layout 恢复 ID） | `claude --resume <id>` | `bind_specific` | 恢复的 ID | 可 regen |
| `ga flow --continue`（无 ID） | `claude --continue` | `auto_latest` | 未设置 | 可 regen（mtime 发现 JSONL） |
| `ga flow --resume` | `claude --resume`（选择器） | `resume_picker` | 未设置 | strict replay |
| `ga flow --resume <id>` | `claude --resume <id>` | `resume_specific` | `<id>` | strict replay |
| `ga doctor` | — | — | — | 检查 claude / bun / zellij / wiki / `.flow-runtime` |
| `./scripts/flow-run.sh --cleanup` | 清理 zellij 会话与残留进程 | — | — | — |

Shell **只负责**把 CLI 标志映射为环境变量；`resume_specific` 等字符串由 `normalizeResumeMode()` 消费（见 `session-binding-policy.ts`）。

### 环境变量（launcher → observer）

| 变量 | 设置方 | 作用 |
|------|--------|------|
| `FLOW_PROJECT_DIR` | `flow-run.sh` | 项目根（JSONL 发现，observer `cwd`） |
| `FLOW_ROOT_DIR` | `flow-run.sh` | 仓库根（wiki、`.flow-runtime` 默认父路径） |
| `FLOW_DATA_DIR` | `flow-run.sh` 或默认 | 运行时目录（默认 `.flow-runtime`） |
| `FLOW_WIKI_DIR` | 可选 | 覆盖 wiki 根（优先级见 `data/env.ts`） |
| `FLOW_LAYOUT_DIR` | 可选 | 覆盖 layout 目录（默认 `FLOW_DATA_DIR/layouts`） |
| `FLOW_RESUME_MODE` | `flow-run.sh` | `bind_specific` / `auto_latest` / `resume_specific` / `resume_picker` |
| `FLOW_SESSION_ID` | `flow-run.sh`（有则设置） | 绑定 Claude session UUID |
| `FLOW_ZELLIJ_SESSION` | `flow-run.sh` | Zellij 会话名 |
| `FLOW_ZELLIJ_AUTOCLEANUP` | 默认 `1` | 退出时清理 zellij / 孤儿进程 |
| `FLOW_ZELLIJ_ON_FORCE_CLOSE` | 默认 `quit` | 终端关闭时 `quit` 或 `detach` |
| `FLOW_ZELLIJ_OBSERVER_WIDTH` | 可选 | 右栏宽度（%） |
| `FLOW_ZELLIJ_REUSE` | continue 时为 `1` | 复用已有 zellij 会话名 |
| `ZELLIJ_SOCKET_DIR` | 默认 `/tmp/zellij` | 短 socket 路径（macOS） |
| `FLOW_INJECT_BACKEND` | observer | `clipboard` / `none`（`services/flow/inject.ts`） |
| `FLOW_QUIET` | observer UI | 安静模式 |
| `FLOW_NO_ANIMATIONS` | observer UI | 低动态：spinner 间隔 400ms |
| `FLOW_LOCALE` | observer UI | `zh-Hans` 本地化 chrome（摘要正文仍为模型语言） |

### Launcher 进程清理（2026-05-24）

`scripts/flow-run.sh` 在启动 zellij 前会：

1. **`cleanup_stale_launchers`** — 对**其他** `flow-run.sh` PID 先发 `TERM`、0.6s 后 `KILL`；并清理指向 `.flow-runtime/layouts` 的旧 zellij layout 进程（不杀当前 `$$`）。
2. **Pane 进程组** — `wrap_pane_lc()`：`setsid`（Linux）或 `perl setpgrp`（macOS 回退），便于关 tab / `on-force-close quit` 时带走 `claude` 与 `bun run src/main.ts --live`。
3. **退出清理** — `trap` + PPID watchdog + `cleanup_session`：`zellij kill/delete-session` 后对 session/layout/observer/claude 模式做 **TERM → 0.6s → KILL**（参考 CodeWhale `reference/CodeWhale` 子进程策略）。

运维：

```bash
./scripts/flow-run.sh --cleanup   # 全量清理 zellij + 匹配进程
pgrep -fl 'flow-run|zellij.*flow-runtime'   # 关 tab 后应无残留
FLOW_ZELLIJ_AUTOCLEANUP=0 ./scripts/flow-run.sh   # 调试：退出时不清理
```

策略与可见性：`scheme/src/services/session/session-binding-policy.ts`。**不要在 app 组件里复制 binding 分支。**

### Resume 模式下的 UI 可见性

`deriveSessionBindingState()` 在 `resume_*` 且尚无图缓存/flowchart 时设 `visibility: 'hide'`，`LiveObserverContainer` 传给 `flowBodyVisible={false}`。摘要缺失时显示 `replayOnlyHint`，不调用 `generateMissing`。

## 3. 分层架构（第一性原理）

```
┌─────────────────────────────────────────┐
│  Shell: scripts/flow-run.sh             │  进程编排、环境注入
├─────────────────────────────────────────┤
│  App: scheme/src/app/                   │  UI、observer hooks、组合
├─────────────────────────────────────────┤
│  Services: scheme/src/services/         │  AI、session、wiki、stream、flow
├─────────────────────────────────────────┤
│  Data: scheme/src/data/                 │  协议、repository、env 解析
├─────────────────────────────────────────┤
│  Domain: scheme/src/domain/             │  纯模型、树、活动分析
├─────────────────────────────────────────┤
│  constants/ + utils/                    │  跨层常量与纯工具
└─────────────────────────────────────────┘
         ↓ 只读
   Claude JSONL（~/.claude/projects/...）
```

**依赖方向（必须遵守）**

| 层 | 可依赖 | 禁止 |
|----|--------|------|
| `app/` | `services/*`, `data/protocol/*`, `domain/*`, `constants/*`, `utils/*` | 直接 `fs` 写 wiki |
| `services/` | `data/*`, `domain/*`, `constants/*`, `utils/*` | React / OpenTUI 组件 |
| `data/` | `domain/*`, `constants/*`, `utils/*`, `protocol/*`, `node:fs` | `app/*`、`services/*` |
| `domain/` | `constants/*`, `utils/*` | `app/`, `services/`, `data/`（含 IO） |

**`scheme/src/data/` 当前模块**

| 路径 | 职责 |
|------|------|
| `env.ts` | `resolveWikiRoot`, `resolveFlowDataDir`, `resolveLayoutDir` |
| `protocol/observer-protocol.ts` | 跨层类型与 ID 规则 |
| `protocol/wiki-types.ts` | Wiki 持久化/匹配相关类型（无 service 依赖） |
| `protocol/jsonl-line-parser.ts` | Claude JSONL 行 → `CliEventEnvelope` |
| `session/claude-project.ts` | `~/.claude/projects/...` 会话路径发现 |
| `session/jsonl-session.ts` | JSONL 解析、exploration 提取、stats |
| `session/session-types.ts` | `Exploration` / `SessionStats` 类型 |
| `session/repository.ts` | `FileSessionRepository` 轮询快照 |
| `session/session-flow-repository.ts` | `wiki/sessions/{id}.json` |
| `session/graph-patch-repository.ts` | `wiki/sessions/{id}-graph-patches.json` |
| `wiki/knowledge-repository.ts` | `wiki/knowledge/{type}/` |
| `wiki/evidence-repository.ts` | `wiki/sessions/{id}-evidence.json` |
| `wiki/note-repository.ts` | `NoteRepository` CRUD → `wiki/notes/{date}.md` |
| `wiki/summary-repository.ts` | `SummaryRepository` CRUD → `wiki/sessions/{id}-summaries.json` |
| `wiki/wiki-data-layout.ts` | 三链路径常量（knowledge / sessions / notes） |
| `management/data-governance.ts` | 去重、治理 |

**`scheme/src/services/` 主要模块（编排层）**

| 路径 | 职责 |
|------|------|
| `session/session-binding-policy.ts` | Binding + summary + visibility 策略 |
| `session/observer-session-service.ts` | `PollingObserverSessionService` 轮询 JSONL |
| `session/graph-cache-service.ts` | 图缓存读写编排 |
| `session/graph-patch-service.ts` / `graph-digest-service.ts` | 图补丁与 digest |
| `ai/exploration-summary-service.ts` | 摘要 hydrate/generate（注入 `SummaryRepository`） |
| `ai/graph-consolidation-service.ts` | 周期性图合并 |
| `wiki/persistence-service.ts` | exploration 完成 → knowledge + evidence |
| `wiki/match-service.ts` | Wiki 搜索匹配 |
| `wiki/inspiration-note-service.ts` | 灵感笔记编排（注入 `NoteRepository`） |
| `wiki/auto-extractor.ts` | exploration → knowledge 提取（不含笔记 IO） |
| `flow/inject.ts` | 剪贴板注入 |

## 4. 数据存储：不是 Database

**没有统一 SQL/ORM。** 见 `scheme/src/data/env.ts` 注释（SQLite 已移除）。

| 层 | 路径 | 内容 | 写入路径 |
|----|------|------|----------|
| Source | `~/.claude/projects/.../*.jsonl` | Claude 会话 | Claude（observer 只读） |
| Derived | `wiki/sessions/{id}-summaries.json` | AI 摘要 + flowchart | `FileSummaryRepository`（`data/wiki/summary-repository.ts`） |
| Derived | `wiki/sessions/{id}.json` | 图 + hints | `session-flow-store` → `session-flow-repository` |
| Derived | `wiki/sessions/{id}-evidence.json` | exploration 证据 | `evidence-repository`（经 `persistence-service`） |
| Knowledge | `wiki/knowledge/{type}/*.md` | 长期知识 | `knowledge-repository`（经 `persistence-service`） |
| Notes | `wiki/notes/{YYYY-MM-DD}.md` | 用户灵感/随手记 | `FileNoteRepository`（`create/find/list/update/delete`） |
| Runtime | `.flow-runtime/layouts/zellij-layout-*.kdl` | 每次启动生成的 Zellij layout | `scripts/flow-run.sh` |

新增持久化：**`data/` 加 repository → `services/` 编排 → `app/observer/hooks/` 适配 UI**。

## 5. 核心链路

### 5.1 会话轮询

1. `useSessionPolling` → `PollingObserverSessionService.poll()`
2. `FileSessionRepository` → `claude-project.findLatestSession` + `jsonl-session` 解析
3. `resolveSessionBindingIntent({ resumeModeRaw: FLOW_RESUME_MODE, explicitSessionId: FLOW_SESSION_ID })`
4. 输出 `Exploration[]` + `ActivityTree` + stats

### 5.2 摘要

1. `deriveSessionSummaryPolicy(bindingIntent)` → `{ allowRegen }`
2. `useExplorationSummaries` → `DefaultExplorationSummaryService`
3. `summaryRepo.loadWithStatus` / `hydrateFromWiki`；若 `allowRegen` → `generateMissing` → `summaryRepo.saveOne`
4. `shouldGenerateMissing()` 在 `allowRegen === false` 时直接返回 false

### 5.3 Wiki 匹配与持久化

**匹配**（`services/wiki/match-service.ts`）：`normalizeMatchText()` 去掉中英文虚词/助词（如「的」「了」），避免「分析下当前项目」与「分析下当前的项目」无法命中；标签 YAML 引号在 `knowledge-repository.ts` 读取时剥离。

**ID 分配**（`services/wiki/auto-extractor.ts`）：`getExistingIds()` 扫描 `wiki/knowledge/{contexts,entities}/` 与 `wiki/notes/` 内 `N###` 条目；context 用 `C###`，entity 用 `N###`（`knowledge-normalize.allocateId`）。

**持久化链路**

1. `useWikiPersistence` → `DefaultWikiPersistenceService.persistCompleted`
2. `deduplicateKnowledge`（`data/management/data-governance.ts`）
3. evidence + knowledge 写入

### 5.3b 灵感笔记（非 exploration 自动提取）

```
InspirationPanel → useWikiPersistence.saveInspiration
  → DefaultInspirationNoteService
  → FileNoteRepository (data/wiki/note-repository.ts)
  → wiki/notes/{YYYY-MM-DD}.md
```

| 层 | 类型 / 类 | 职责 |
|----|-----------|------|
| data | `NoteRepository` / `FileNoteRepository` | `create` `findById` `listRecent` `listByDate` `update` `delete` |
| services | `DefaultInspirationNoteService` | 注入 repository，对外 `saveInspiration` / `listRecentInspirations` |
| app | `useWikiPersistence` | 只依赖 service，不直接 `fs` 或 `auto-extractor` |

条目 ID 前缀 **`N001`**（与 knowledge 的 E/S/D/C 区分）。格式：`## [HH:MM] 标题` + `id` / `created` / `session_id` + 正文。

### 5.4 图

1. `buildFlowGraphSnapshot`（`app/ui/flow/graph/graph-builder.ts`）
2. `useGraphSnapshot` + `DefaultGraphCacheService`（读写在 `data/session/graph-cache-repository.ts`）
3. `useGraphConsolidation` + `graph-consolidation-service`（可选周期性 digest/patch）

## 6. 如何扩展（检查清单）

### 新 UI 状态或面板

1. `data/protocol/observer-protocol.ts` 定义类型
2. `services/` 实现逻辑
3. `app/observer/hooks/` 写 adapter hook
4. `app/ui/flow/` 渲染
5. `scheme` 下 `*.test.ts`

### 新 session 模式

1. 只改 `session-binding-policy.ts` + `session-binding-policy.test.ts`
2. `scripts/flow-run.sh` 设置 `FLOW_RESUME_MODE` / `FLOW_SESSION_ID`（映射表与本文 §2 一致）
3. 更新本文、`README.md`、`AGENTS.md`

### 新持久化类型

1. `data/wiki/*-repository.ts` 或 `data/session/*`
2. `services/wiki/*` 或 `services/ai/*` 或 `services/session/*`
3. 禁止在 `ExplorationCard.tsx` 等 UI 里直接 `fs.writeFile`

## 7. 本地开发

```bash
./scripts/setup.sh
cd scheme && bun install

cd scheme && bun test
cd scheme && bunx tsc --noEmit

ga doctor
ga flow

./scripts/flow-run.sh --cleanup

# 仅调试右栏 observer（需自行设置 FLOW_PROJECT_DIR / FLOW_SESSION_ID 等）
cd scheme && bun run start:live
```

`scheme/package.json` 的 `start:observer` 与 `start:live` 均指向 `--live`；勿使用已移除的 `--posthoc`。

## 8. 已知分层例外（后续可收敛）

| 位置 | 说明 |
|------|------|
| `services/session/posthoc.ts` | 仅 **re-export** `data/session/*`，新代码勿再依赖 |
| `services/ai/summary-cache.ts` | 仅 **re-export** `data/wiki/summary-repository`，新代码勿再依赖 |

`data/` 层不再 `import services/*`。Wiki 根路径统一 `resolveWikiRoot()`。

### Observer UI

| 区域 | 实现 |
|------|------|
| 顶栏 | `ObserverStatusBar`：活动态、模型、token、完成/错误、摘要·wiki 汇总、高频文件；不展示 session UUID |
| 底栏 | `CommandBar` + `observer-hotkeys.ts` + `observer-key-dispatch.ts`：两行快捷键与 Shell 行为同源；打开帮助时隐藏底栏 |
| 键盘 | 须先聚焦 observer 窗格；`Esc` 只关浮层/笔记，不退出；`q` / Ctrl+Q 退出 |
| 时间线 | `LiveObserverFlowBody` / `ExplorationCard`；无 `[cache:hit]` 角标（统计已上顶栏） |
| 知识卡片 | 聚焦行内联 `WikiMatchCard` + `FlowFramedSection variant="knowledge"` |
| 摘要 | `shouldShowInlineSummary()`：生成中仍显示 SUMMARY 区 |
| 流程图 | `flow-graph-layout.ts`：`rail` / `stack` / `grid`（`FlowGraphView.tsx`） |
| 快捷键帮助 | `HelpOverlay`（`?`、`F1`、`Ctrl+/`、`/`、`Ctrl-K` 同一面板；单块多行文本） |
| 笔记侧栏 | `NotesSidePanel`（`i` 切换右侧栏：Recent notes + 输入）；`c` 简洁模式（默认关：全展开；开：仅最新一条显示 summary，其余一行折叠） |

**Scheme 入口（右栏）**：`bun run src/main.ts --live`（`--observer` 同义）。`--posthoc` 已移除（误触会提示改用 `--live` / `ga flow`）。

快捷键以 `HelpOverlay.tsx` 与 `FlowObserverShell.tsx` 为准。勿恢复已删除的 `ContextPanel` / `UnifiedFooter`。

## 9. 发布前自检

- [ ] `ga doctor` 通过
- [ ] `cd scheme && bun test` 通过
- [ ] `FLOW_RESUME_MODE` 表与 `flow-run.sh`、`AGENTS.md` 一致
- [ ] 未在 `app/` 引入文件 IO（摘要缓存例外在 `services/ai/summary-cache.ts`）
- [ ] 新环境变量已写入 `scripts/flow-run.sh --help` 与 README
- [ ] 治理文档 `docs/data-governance/` 路径与 repository 文件名一致
- [ ] `bunx tsc --noEmit` 无报错
