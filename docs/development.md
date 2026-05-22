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
| `session/graph-cache-repository.ts` | `wiki/runtime/{id}-graph.json` |
| `session/graph-patch-repository.ts` | 图合并补丁文件 |
| `wiki/knowledge-repository.ts` | `wiki/knowledge-base/` |
| `wiki/evidence-repository.ts` | `wiki/evidence/{id}.json` |
| `wiki/note-repository.ts` | `NoteRepository` CRUD → `wiki/daily-notes/{date}.md` |
| `wiki/summary-repository.ts` | `SummaryRepository` CRUD → `wiki/runtime/{id}-summaries.json` |
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
| Derived | `wiki/runtime/{id}-summaries.json` | AI 摘要 + flowchart | `FileSummaryRepository`（`data/wiki/summary-repository.ts`） |
| Derived | `wiki/runtime/{id}-graph.json` | 图快照 | `graph-cache-service` → `graph-cache-repository` |
| Derived | `wiki/evidence/{id}.json` | exploration 证据 | `evidence-repository`（经 `persistence-service`） |
| Knowledge | `wiki/knowledge-base/{type}/*.md` | 长期知识 | `knowledge-repository`（经 `persistence-service`） |
| Notes | `wiki/daily-notes/{YYYY-MM-DD}.md` | 用户灵感/随手记 | `FileNoteRepository`（`create/find/list/update/delete`） |
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

### 5.3 Wiki 持久化

1. `useWikiPersistence` → `DefaultWikiPersistenceService.persistCompleted`
2. `deduplicateKnowledge`（`data/management/data-governance.ts`）
3. evidence + knowledge-base 写入

### 5.3b 灵感笔记（非 exploration 自动提取）

```
InspirationPanel → useWikiPersistence.saveInspiration
  → DefaultInspirationNoteService
  → FileNoteRepository (data/wiki/note-repository.ts)
  → wiki/daily-notes/{YYYY-MM-DD}.md
```

| 层 | 类型 / 类 | 职责 |
|----|-----------|------|
| data | `NoteRepository` / `FileNoteRepository` | `create` `findById` `listRecent` `listByDate` `update` `delete` |
| services | `DefaultInspirationNoteService` | 注入 repository，对外 `saveInspiration` / `listRecentInspirations` |
| app | `useWikiPersistence` | 只依赖 service，不直接 `fs` 或 `auto-extractor` |

条目 ID 前缀 **`N001`**（与 knowledge-base 的 E/S/D/C 区分）。格式：`## [HH:MM] 标题` + `id` / `created` / `session_id` + 正文。

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
cd scheme && bunx tsc --noEmit   # 已知有部分历史 TS 报错，以 bun test 为准

ga doctor
ga flow

./scripts/flow-run.sh --cleanup
```

## 8. 已知分层例外（后续可收敛）

| 位置 | 说明 |
|------|------|
| `services/session/posthoc.ts` | 仅 **re-export** `data/session/*`，新代码勿再依赖 |
| `services/ai/summary-cache.ts` | 仅 **re-export** `data/wiki/summary-repository`，新代码勿再依赖 |

`data/` 层不再 `import services/*`。Wiki 根路径统一 `resolveWikiRoot()`。

## 9. 发布前自检

- [ ] `ga doctor` 通过
- [ ] `cd scheme && bun test` 通过
- [ ] `FLOW_RESUME_MODE` 表与 `flow-run.sh`、`AGENTS.md` 一致
- [ ] 未在 `app/` 引入文件 IO（摘要缓存例外在 `services/ai/summary-cache.ts`）
- [ ] 新环境变量已写入 `scripts/flow-run.sh --help` 与 README
- [ ] 治理文档 `docs/data-governance/` 路径与 repository 文件名一致
- [ ] `bunx tsc --noEmit` 无报错
