# Flow Observer — 数据保存与展示策略

单源策略定义：`scheme/src/services/session/session-presentation-policy.ts`（模式）+ `scheme/src/app/observer/view-model/presentation-summaries.ts`（摘要档位）。

## 用户流程 → 模式

| 启动 | 模式 | 摘要写入 | 摘要读取 |
|------|------|----------|----------|
| `ga flow` | **live** | 可 AI 生成并写入 `wiki/sessions/{id}-summaries.json` | L4→L2→L3→L1→L0 |
| `ga flow -c` | **live** | 同上 | 同上 |
| `ga flow -r [id]` | **replay** | 不生成 | L2→L2s→L3→L1→L0 |

## 数据层

| 层 | 路径 | 角色 |
|----|------|------|
| 事实 | `~/.claude/projects/.../{sessionId}.jsonl` | 时间轴真相源 |
| 派生 | `wiki/sessions/{sessionId}-summaries.json` | AI 摘要 + flowchart |
| 派生 | `wiki/sessions/{sessionId}.json` | Flow 图 + flowchartHints |
| Wiki 资产 | `wiki/knowledge/` | 长期知识 |
| 证据 | `wiki/sessions/{sessionId}-evidence.json` | 会话证据 |

## 摘要档位（展示）

| 档位 | 来源 | Replay | Live |
|------|------|--------|------|
| L0 timeline | JSONL | 始终 | 始终 |
| L1 excerpt | 规则摘录 `exploration-excerpt.ts` | 缺摘要时填充 | 不填充 |
| L2 cache | summaries.json 有效 | ✓ | ✓ |
| L2s stale | 缓存旧于 JSONL | 只读展示，不删文件 | 清除并 regen |
| L3 wiki | knowledge | ✓ | ✓ |
| L4 ai | generateMissing | ✗ | ✓ |

卡片 Summary 区显示档位标签（AI / 缓存 / 过期快照 / Wiki / 时间轴摘录）。

## UI 规则

- **顶栏**：`Live` / `Replay` 徽章 + 模型 / token / done / errors / wiki 已存
- **Replay banner**：一行说明 + 可选 `N stale · N excerpt`
- **时间轴**：有 exploration 即显示（replay 不再因缺 summary 整页 hide）
- **Next 面板**：仅 live 显示
- **Calm**：仅最新条完整 Summary；其余一行折叠

## 实现边界

- 绑定与 `allowRegen`：`session-binding-policy.ts`
- 展示策略：`session-presentation-policy.ts`
- 缓存过期：`summary-repository.loadWithStatus(..., { onExpired: 'stale' | 'clear' })`
- UI 禁止直接读 repository（见 [ui-layer-rules.md](ui-layer-rules.md)）
