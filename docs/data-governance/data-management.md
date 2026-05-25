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
| AI Summary 缓存 | `wiki/sessions/{session}-summaries.json` | JSONL mtime 变化 | 低（重新调用AI） | 默认过期自动重建；`resume` 模式仅回放不重建 |
| Evidence 数据 | `wiki/sessions/{session}-evidence.json` | 无/长期 | 中（需重新解析） | 孤儿检测后清理 |

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

// 2. 派生缓存（实现分散，按职责拆分）
// data/wiki/summary-repository.ts — SummaryRepository CRUD → wiki/sessions/{id}-summaries.json
// data/session/session-flow-repository.ts — SessionFlowRecord → wiki/sessions/{id}.json
// data/wiki/evidence-repository.ts — EvidenceRepository → wiki/sessions/{id}-evidence.json

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
// app/observer/hooks/useWikiCurator.ts — 策展 + 灵感（useWikiPersistence 为别名）
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
  ├── useSessionPolling.ts → PollingObserverSessionService
  ├── useExplorationSummaries.ts → DefaultExplorationSummaryService
  ├── useGraphSnapshot.ts → graph-cache-service
  └── useWikiCurator.ts → WikiCuratorService + InspirationNoteService

services/ (服务层)
  ├── session/
  │   ├── observer-session-service.ts → data/session/repository.ts (JSONL)
  │   ├── session-binding-policy.ts
  │   └── graph-cache-service.ts → graph-cache-repository.ts
  ├── ai/
  │   ├── exploration-summary-service.ts
  │   └── summary-cache.ts → wiki/sessions/{id}-summaries.json
  └── wiki/
      ├── wiki-curator-service.ts → intent digest + Wiki Agent（默认路径）
      ├── persistence-service.ts → legacy per-turn（FLOW_WIKI_LEGACY_PER_TURN=1）
      ├── inspiration-note-service.ts → note-repository
      └── match-service.ts → knowledge-repository

data/ (数据层)
  ├── protocol/
  │   └── observer-protocol.ts (类型定义)
  ├── session/
  │   ├── claude-project.ts (会话路径发现)
  │   ├── jsonl-session.ts (JSONL 解析 / exploration)
  │   ├── session-types.ts
  │   ├── repository.ts (FileSessionRepository)
  │   ├── graph-cache-repository.ts (sessions 图快照)
  │   └── graph-patch-repository.ts (图合并补丁)
  ├── wiki/
  │   ├── wiki-data-layout.ts (路径常量)
  │   ├── knowledge-repository.ts (知识库 CRUD)
  │   ├── evidence-repository.ts (evidence 聚合)
  │   ├── note-repository.ts (notes 灵感笔记)
  │   └── summary-repository.ts (sessions 摘要缓存)
  └── management/
      └── data-governance.ts (去重、清理、一致性检查)
```

## 6. 关键设计原则

1. **单一真相源**: JSONL 是唯一的派生数据来源
2. **分层隔离**: UI 层不直接访问文件系统
3. **写时治理**: 保存知识时进行去重和审核
4. **懒加载**: 缓存按需加载；new/continue 可自动重建，resume 仅回放
5. **可重建性**: 所有派生数据都可从 JSONL 重建
