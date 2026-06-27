# GUI-Anything — Agent 协作约定

> **Coding Agent 读本**：共同原则、心智模型、架构红线、完成标准。  
> **不要在本文件堆细节** — 模块表、env 全表、Wiki 时序 → [docs/development.md](docs/development.md) · [docs/data-governance/data-flow.md](docs/data-governance/data-flow.md)

---

## 1. 项目是什么

双栏 **Flow Observer**：左 = Claude Code，右 = `scheme/` 实时读 JSONL、展示时间线/flowchart、按需写 `wiki/`。

- 对外入口：**`ga flow`** · **`ga doctor`**
- Observer **不驱动** Claude；只读 `~/.claude/projects/.../*.jsonl`，写派生数据到 `wiki/`
- 主代码：**`scheme/src/`**；启动器：**`scripts/flow-run.sh`**（唯一 flow launcher）

---

## 2. 共同原则

### 2.1 产品（与 README 一致）

| 原则 | 含义 | 编码时意味着 |
|------|------|--------------|
| **心流** | 不打扰左屏 Claude | 不增常驻弹层；wiki/帮助/笔记仅显式快捷键 |
| **按需知识** | 需要时才检索/落盘 | KNOWLEDGE ≠ 每轮写 wiki；策展在 pivot/sweep |
| **无感使用** | 一条命令启动 | 逻辑靠 `FLOW_*` 注入，不让用户手填路径 |

### 2.2 工程（与 development §2 一致）

| 原则 | 含义 |
|------|------|
| **分层单向** | `data → services → app(hooks/view-model) → ui`；UI 禁止 `fs` / repository |
| **策略单点** | binding、摘要 regen、wiki 门禁各只有一个权威模块 — **禁止复制分支** |
| **协议先行** | 跨层形状在 `data/protocol/`；改行为先改类型/策略，再改 UI |
| **小步可验证** | 最小 diff；`bun test` + `tsc`；行为变更加测试 |
| **文档跟代码** | 细节进 `docs/`；本文件只保留原则级变更 |
| **统一日志** | Flow 调试用 `createLogger`（`scheme/src/utils/logger.ts`），勿新增裸 `console.*`；见 development §5.2 Debugging Flow |

### 2.3 心智模型 Run / Capture / Guide

| 层 | 做什么 | 典型入口 |
|----|--------|----------|
| **Run** | 读 JSONL，展示 exploration / 工具 / 错误 | `useSessionPolling` |
| **Capture** | 摘要、flowchart hint、intent bucket、Wiki 策展 | `useExplorationSummaries` · `useWikiCurator` |
| **Guide** | Prior wiki、flowchart | `useWikiMatches` · `FlowGraphView` |

---

## 3. Agent 工作流程

```
接到任务
  → 读 docs/development.md 相关节（§2 宪法 · §4 模块 · §7 扩展）
  → 确定改动层（protocol / data / services / view-model / hook / ui）
  → 实现（匹配现有命名与 import 风格）
  → cd scheme && bun test && bunx tsc --noEmit
  → 按需更新 docs/（见 development §1.4），勿改无关文件
  → 汇报：改了什么、测了什么、剩余风险
```

**不要**：未读分层就改 UI；在 `ExplorationCard` 里写 wiki IO；顺手大 refactor；提交 `wiki/`。

---

## 4. 架构红线

### 4.1 依赖

| 目录 | 禁止 |
|------|------|
| `app/ui/flow/**` | import `services/*`、`data/wiki/*`、`data/session/*` repository |
| `app/observer/view-model/**` | import services、OpenTUI、repository |
| `services/**` | import OpenTUI / React 组件 |
| `data/**` | import `app/*`、`services/*` |

编排入口：**`LiveObserverContainer.tsx`** → **`shell-props.ts`** → **`FlowObserverShell.tsx`**。  
细则：[ui-layer-rules.md](docs/data-governance/ui-layer-rules.md)

### 4.2 单一真相源（改这里，别处只消费）

| Concern | 权威文件 |
|---------|----------|
| Session 绑定 / resume | `services/session/session-binding-policy.ts` · 发现 `data/session/session-discovery.ts` |
| Continue index | `data/session/session-index.ts` → `wiki/sessions/_index.json` |
| Session bundle（data） | `data/wiki/session-bundle-repository.ts` → `wiki/sessions/{id}/bundle.json` |
| Session bundle（应用层） | `services/session/session-bundle-service.ts`（`getSessionBundleRepository` · `ensureExplorationRetrieval`） |
| Live vs Replay / 摘要 regen | `services/session/session-runtime-policy.ts` · Replay banner：`session-banner.ts` |
| 摘要编排（非 React） | `services/ai/summary-orchestrator.ts` · 实现：`exploration-summary-service.ts` |
| Prior KNOWLEDGE 检索 | `wiki-retrieval-policy.ts` · `exploration-card-pipeline.ts` → **`SessionBundleService`** |
| Wiki 落盘（策展） | `wiki-curator-service.ts` · 门禁 `wiki-persist-policy.ts` — 与检索独立，见 [data-flow.md](docs/data-governance/data-flow.md) |
| Flowchart intent **badge** | `data/protocol/flowchart-intent.ts`（**仅 `intent_key`**） |
| Intent 词表 / wiki 策展门禁 | `constants/session-intent-keys.ts` |
| Wiki 路径 | `data/wiki/wiki-data-layout.ts` · `resolveWikiRoot()` |
| JSONL 解析 | `data/session/jsonl-session.ts`（**勿用** legacy `posthoc.ts`） |
| Summary 形状 | `data/protocol/summary-contract.ts` |
| 项目演进史导出 | data `data/wiki/project-evolution-repository.ts`（跨 bundle 读 intent）· 编排 `services/evolution/evolution-service.ts` · AI 纪元 `services/ai/evolution-abstract.ts` · HTML `export/evolution/` |

### 4.3 持久化

- 文件 IO **只在** `scheme/src/data/**` repositories
- 新链路：`data/` → `services/` → `app/observer/hooks/` → UI
- 根目录 **`wiki/`** gitignore — 不 commit 本地知识库

---

## 5. 常见误解（改代码前核对）

| 误解 | 实际 |
|------|------|
| 每轮 exploration 都写 wiki | **默认否**。同 intent 只积累 bucket；**pivot / idle sweep** 才策展 |
| `node_id` 当 intent badge | **否**。badge / 顶栏 / wiki 门禁用 **`intent_key`**；`node_id` 仅 flowchart 树 |
| explore 也要 wiki write badge | **否**。ineligible intent 不展示 skip/saved badge（`wiki-write-chrome.ts`） |
| KNOWLEDGE 卡片 = 刚落盘 | **否**。KNOWLEDGE = **prior 检索**（running 起）；与 write badge 独立 |
| Resume 要 regen 缺失摘要 | **否**。`resume_*` = strict replay，见 binding policy |
| `-c` 会删掉已有摘要 | **否**。读 `wiki/sessions/{id}/bundle.json`；JSONL 变新不删 bundle；只为新 exploration 调 AI |
| `summaryPreview` 是摘要源 | **否**。仅流程图节点文案；摘要真相源是 `bundle.explorations[id].summary` |
| Shell 里写 binding 分支 | **否**。`flow-run.sh` 只设 `FLOW_*` |
| Web Mirror 自动跟 flow 同 session | **否**。独立进程需手动 `FLOW_SESSION_ID` |
| Skill 失败用 auto-extractor create | **否**。策展路径 skill 失败 → `skipped`，不回落 create |
| Observer 用 `matchWikiForExploration` 查 prior | **否**。UI / 热键 `k` 走 **`SessionBundleService.ensureExplorationRetrieval`**（与 KNOWLEDGE 卡片一致） |

Wiki 细节：`useWikiCurator`（`useWikiPersistence` 为别名）· Phase 2 → `scripts/wiki/wiki-maintain.sh` · skill → `skills/llm-wiki/`

---

## 6. 查表：任务 → 先读哪里

| 任务 | 先读 |
|------|------|
| 任何开发 / 扩展 | [development.md](docs/development.md) §1–§2、§7 |
| Wiki 链路 / 时序 | [data-flow.md](docs/data-governance/data-flow.md) |
| UI import / chrome | [ui-layer-rules.md](docs/data-governance/ui-layer-rules.md) · development §8 |
| Live/Replay 摘要 | [display-policy.md](docs/data-governance/display-policy.md) |
| Session 模式 / env | development §5 · `flow-run.sh --help` |
| Wiki CLI / env | [scripts/wiki/README.md](scripts/wiki/README.md) |
| 通知 | [docs/NOTIFICATION.md](docs/NOTIFICATION.md) |
| HTML export | development §6 · `scheme/src/export/` |
| 对外用户文档 | `README.md` |

**Repo 地图**

| 路径 | 用途 |
|------|------|
| `scheme/src/app/` | UI + observer hooks/view-model |
| `scheme/src/services/` | 编排（无 UI） |
| `scheme/src/data/` | protocol + repository |
| `scripts/flow-run.sh` | 双栏启动 |
| `scripts/wiki/` | Wiki 维护 CLI |
| `skills/llm-wiki/` | Wiki Agent skill 源码 |
| `docs/` | 设计与 runbook（**详细文档放这里**） |

---

## 7. 完成标准

```bash
cd scheme && bun test && bunx tsc --noEmit
ga doctor
```

- [ ] 未违反 §4 红线
- [ ] 行为变更有关联测试（或说明为何不测）
- [ ] 未提交 `wiki/`
- [ ] 用户可见变化已更新 `docs/` 或 `README.md`（development §1.4）
- [ ] 新 `FLOW_*` 已写入 `flow-run.sh --help` 与 development §5.2
- [ ] **本文件仅在有新原则/红线时更新**；细节只进 `docs/development.md`

---

## 8. Session 速记

| 用户命令 | `FLOW_RESUME_MODE` | Observer |
|----------|-------------------|----------|
| `ga flow` | `bind_specific` | live：新 session，随 Claude 构建 wiki |
| `ga flow -c` / `-r <id>` | `continue` | wiki 有数据 → replay；无数据 → **live 同步** Claude jsonl |
| `ga flow -c`（无 prior id） | `continue` | Claude `--continue`；observer 绑定后 live 构建 |
| `ga flow -r` | `continue_picker` | picker 选中后同上 |

Policy：`session-runtime-policy.ts`（单链）· 摘要：`summary-orchestrator.ts` · 标签：`summary-provenance.ts` · 存储：`wiki/sessions/{id}/bundle.json`
