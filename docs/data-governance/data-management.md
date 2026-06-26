# 统一数据管理策略

## 1. 数据分层（与架构对应）

```
┌─────────────────────────────────────────────────────────────────┐
│                      DATA LAYER                                │
├─────────────────────────────────────────────────────────────────┤
│  Source Layer (真相源)                                          │
│  ├── Claude JSONL (外部管理，只读)                             │
│  └── 生命周期: 由 Claude 管理，我们不修改                       │
├─────────────────────────────────────────────────────────────────┤
│  Derived Layer (派生数据)                                       │
│  ├── wiki/sessions/          ← 摘要、图、evidence（json）       │
│  └── 生命周期: 临时/短期，可重建                               │
├─────────────────────────────────────────────────────────────────┤
│  Knowledge Layer (知识层)                                       │
│  ├── wiki/knowledge/         ← 有价值的知识条目                │
│  └── wiki/notes/             ← 灵感笔记                        │
│  └── 生命周期: 长期，人工审核后保留                              │
└─────────────────────────────────────────────────────────────────┘
```

## 2. 数据生命周期策略

### 2.1 Source Layer (外部)
- **Claude JSONL**: 只读，不修改
- **作用**: 派生数据的唯一真相源
- **失效策略**: 通过 mtime 检测变化，派生数据自动过期

### 2.2 Derived Layer (临时)

| 数据类型 | 存储位置 | TTL | 重建成本 | 清理策略 |
|---------|---------|-----|---------|---------|
| Session 聚合 | `wiki/sessions/{id}/bundle.json` | 永久（按 exploration） | 低（live 补缺） | JSONL 变新标记 stale，不删文件 |
| 继续指针 | `wiki/sessions/_index.json` | 永久 | 低 | workspace 不匹配则忽略 |

`bundle.json` 含：`explorations[].summary`、`retrieval`、`write`、`session.flow`、`curation`。

### 2.3 Knowledge Layer (长期)

| 数据类型 | 存储位置 | TTL | 更新策略 | 去重策略 |
|---------|---------|-----|---------|---------|
| 知识条目 | `wiki/knowledge/{type}/{id}-{slug}.md` | 永久 | 置信度更高时覆盖 | 相似度>0.8时合并 |
| 灵感笔记 | `wiki/notes/{date}.md` | 永久 | `FileNoteRepository` CRUD | 同日多条不合并 |

## 3. 分层数据访问接口

```typescript
// data/ 层提供统一接口

// 1. SessionRepository - 读取 JSONL 真相源
interface SessionRepository {
  readSession(sessionId: string): Promise<SessionSnapshot>;
  findLatestSession(projectDir: string): Promise<SessionInfo | null>;
  // 注意: 不写操作，JSONL 是只读的
}

// 2. Session bundle（派生聚合）
// data/wiki/session-bundle-repository.ts — bundle.json CRUD + patch retry
// data/session/session-flow-repository.ts — bundle.session.flow 切片
// data/wiki/intent-bucket-repository.ts / evidence-repository.ts — bundle.curation 切片
// services/session/session-bundle-service.ts — hooks 访问 facade
// services/session/session-index-service.ts — _index.json facade

// 3. KnowledgeRepository - 管理知识库
interface KnowledgeRepository {
  // CRUD 知识条目
  findById(id: string): KnowledgeEntry | null;
  findBySource(sessionId: string, explorationId: string): KnowledgeEntry | null;
  findSimilar(content: string, threshold: number): KnowledgeEntry | null; // 去重用
  save(entry: KnowledgeEntry, options: { overwrite?: boolean }): SaveResult;
  delete(id: string): boolean;
  
  // 搜索
  search(query: string): KnowledgeEntry[];
  listByType(type: KnowledgeType): KnowledgeEntry[];
  
  // 统计
  stats(): KnowledgeStats;
}

// 4. NoteRepository - 灵感笔记 CRUD
// data/wiki/note-repository.ts — FileNoteRepository
//   create / findById / listRecent / listByDate / update / delete
// services/wiki/inspiration-note-service.ts — DefaultInspirationNoteService
// app/observer/hooks/useWikiCurator.ts — 策展 + 灵感
```

## 4. 数据治理机制

### 4.1 一致性保证
```
JSONL (mtime) → 触发缓存失效 → 重新解析 → （new/continue）重新生成AI摘要
                ↓
           Evidence 更新（增量追加）
                ↓
           Knowledge 更新（人工审核后）
```

### 4.2 去重策略

```typescript
// 保存知识前的去重检查
async function deduplicateKnowledge(newEntry: KnowledgeEntry): Promise<Action> {
  // 1. 查找相似内容
  const similar = await knowledgeRepo.findSimilar(newEntry.content, 0.8);
  
  if (similar) {
    // 2. 判断是更新还是跳过
    if (newEntry.confidence > similar.confidence + 0.1) {
      return { action: 'update', target: similar.id };
    }
    return { action: 'skip', reason: 'similar_exists' };
  }
  
  return { action: 'create' };
}
```

### 4.3 孤儿数据清理

```typescript
// 定期任务：清理无对应 knowledge 的 evidence
async function cleanupOrphanEvidence(): Promise<CleanupReport> {
  const allSessions = evidenceRepo.listSessions();
  const orphaned: string[] = [];
  
  for (const sessionId of allSessions) {
    const evidence = evidenceRepo.loadEvidence(sessionId);
    const hasKnowledge = await knowledgeRepo.hasAnyFromSession(sessionId);
    
    // 如果 session 已结束且没有 knowledge，删除 evidence
    if (!hasKnowledge && isSessionExpired(sessionId)) {
      evidenceRepo.deleteEvidence(sessionId);
      orphaned.push(sessionId);
    }
  }
  
  return { deleted: orphaned };
}
```

## 5. 与分层架构的映射

```
app/ (应用层)
  ├── useSessionPolling.ts → SessionIndexService.touchLastSession
  ├── useExplorationSummaries.ts → DefaultExplorationSummaryService
  ├── useGraphSnapshot.ts → graph-cache-service（唯一 flow 写入）
  └── useWikiCurator.ts → WikiCuratorService + SessionBundleService

services/ (服务层)
  ├── session/
  │   ├── session-bundle-service.ts → session-bundle-repository
  │   ├── session-index-service.ts → session-index
  │   ├── observer-session-service.ts → data/session/repository.ts (JSONL)
  │   ├── session-binding-policy.ts
  │   ├── session-runtime-policy.ts
  │   ├── session-banner.ts
  │   ├── exploration-card-pipeline.ts
  │   └── graph-cache-service.ts → session-flow-repository
  ├── ai/
  │   ├── summary-orchestrator.ts
  │   └── exploration-summary-service.ts → bundle explorations + intent
  └── wiki/
      ├── wiki-curator-service.ts
      └── match-service.ts → knowledge-repository

data/ (数据层)
  ├── protocol/
  │   ├── observer-protocol.ts
  │   └── summary-provenance.ts（cached/fallback 入口）
  ├── session/
  │   ├── session-index.ts
  │   ├── session-discovery.ts
  │   └── session-flow-repository.ts
  └── wiki/
      ├── session-bundle-repository.ts
      ├── session-bundle-types.ts
      ├── knowledge-repository.ts
      └── evidence-repository.ts → bundle.curation.evidence
```

## 6. 关键设计原则

1. **单一真相源**: JSONL 是唯一的派生数据来源
2. **分层隔离**: UI 层不直接访问文件系统
3. **写时治理**: 保存知识时进行去重和审核
4. **懒加载**: 缓存按需加载；new/continue 可自动重建，resume 仅回放
5. **可重建性**: 所有派生数据都可从 JSONL 重建
