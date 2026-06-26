# Flow Observer — 数据保存与展示策略

单源策略：
- 模式：`scheme/src/services/session/session-runtime-policy.ts`
- 摘要标签：`scheme/src/data/protocol/summary-provenance.ts`（`cached` / `fallback` 唯一入口）

## 用户流程 → 模式

| 启动 | 模式 | wiki 有数据 | wiki 无数据 |
|------|------|-------------|-------------|
| `ga flow` | live | live 构建 | live 构建 |
| `ga flow -c` / `-r [id]` | continue | **replay**（只读 bundle） | **live 同步** Claude jsonl，构建 bundle |
| `ga flow -r`（picker） | continue_picker | 选中后同上 | 选中后同上 |

运行时由 `deriveSessionRuntime` 决定 replay vs live；Claude jsonl 始终是 session 真相源。

## 数据层（bundle 聚合）

| 层 | 路径 | 角色 |
|----|------|------|
| 事实 | `~/.claude/projects/.../{sessionId}.jsonl` | 时间轴真相源 |
| 继续指针 | `wiki/sessions/_index.json` | workspace 级 lastSessionId |
| 会话快照 | `wiki/sessions/{sessionId}/bundle.json` | **唯一** session 派生聚合 |
| Wiki 资产 | `wiki/knowledge/` | 长期知识 markdown |

### `bundle.json` 字段

| 字段 | 含义 |
|------|------|
| `meta` | sessionId、workspaceRoot、jsonlPath、jsonlMtime |
| `session.intent` | intent 标题状态 |
| `session.flow` | flow 图、fingerprint、flowchartHints、graphPatchLedger |
| `curation` | intent buckets、evidence |
| `explorations[id].summary` | AI 摘要（存 `ai`/`fallback` 生成来源） |
| `explorations[id].retrieval` | KNOWLEDGE 检索：`undefined` 未扫 · `null` 无 hit · `object` 命中快照（`origin: retrieved`） |
| `explorations[id].write` | Wiki 策展落盘结果（`origin: saved`） |

## 摘要展示（SUMMARY 标签）

判定入口：`resolveSummaryDisplayTier()` in `summary-provenance.ts`

| UI 标签 | 含义 | 条件 |
|---------|------|------|
| （无） | 本轮 AI 成功 | `source: ai` |
| **cached** | 从 session bundle 读出 | hydrate → `source: cache` |
| **fallback** | 降级路径 | `source: fallback`，或 replay excerpt |

Live 生成中用 `live_preview` 更新 intent/title，但 SUMMARY 正文先显示 loading 行；等 AI summary ready 后再替换为最终文本，**不显示**标签。

## 缓存与 JSONL mtime

- `loadWithStatus`：JSONL 变新 → `stale`，**仍返回 bundle**（不删除）。
- Live：仅为缺 `status: ready` 的 exploration 调 AI。
- Restore / Replay：`allowSummaryRegen: false`；缺文用规则 excerpt（标 fallback）。

`workspaceRoot` 必须与当前 git 根一致；mismatch 视为 invalid。

## Flow 图持久化

**唯一写入路径**：`useGraphSnapshot` → `graph-cache-service` → `bundle.session.flow`（300ms debounce）。摘要服务不再写 flow。

## UI 规则

- **时间线卡片**：Running turn 的 `Active` 与 SUMMARY loading 行复用同一个 Node/Ora 风格 spinner（`⠋ ⠙ ⠹ …`）；summary 生成时 meta 行保持 turn 状态静态，避免上下两个 `Summarizing`。新卡片进入与 summary ready 只做一次短暂 accent，不做持续闪烁。未知进度不画 progress，只有真实百分比或步骤数明确时才使用进度条。
- **顶栏**：`Live` / `Replay` + 模型 / token / done / wiki 已存
- **Replay banner**：一行说明 + 可选 `N excerpt · N timeline-only`
- Hook 通过 `SessionBundleService` / `SessionIndexService` 访问 bundle（见 [ui-layer-rules.md](ui-layer-rules.md)）

## 实现边界

- 绑定与 regen：`session-binding-policy.ts`
- 展示策略：`session-runtime-policy.ts` · Replay banner：`session-banner.ts`
- 摘要编排：`summary-orchestrator.ts` · `exploration-summary-service.ts`
- Hydrate 门闩：`summariesReadyKey` = `sessionId|jsonlPath`
- Bundle facade：`services/session/session-bundle-service.ts`
