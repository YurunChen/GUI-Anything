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
│  ├── wiki/runtime/            ← AI Summary 缓存                 │
│  ├── wiki/evidence/          ← 原始 exploration 数据            │
│  └── 生命周期: 临时/短期，可重建                               │
├─────────────────────────────────────────────────────────────────┤
│  Knowledge Layer (知识层)                                       │
│  ├── wiki/knowledge-base/    ← 有价值的知识条目                │
│  └── wiki/daily-notes/       ← 灵感笔记                        │
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
| AI Summary 缓存 | `wiki/runtime/{session}-summaries.json` | JSONL mtime 变化 | 低（重新调用AI） | 默认过期自动重建；`resume` 模式仅回放不重建 |
| Evidence 数据 | `wiki/evidence/{session}.json` | 无/长期 | 中（需重新解析） | 孤儿检测后清理 |

### 2.3 Knowledge Layer (长期)

| 数据类型 | 存储位置 | TTL | 更新策略 | 去重策略 |
|---------|---------|-----|---------|---------|
| 知识条目 | `wiki/knowledge-base/{type}/{id}-{slug}.md` | 永久 | 置信度更高时覆盖 | 相似度>0.8时合并 |
| 每日笔记 | `wiki/daily-notes/{date}.md` | 永久 | 追加 | 不重复 |

## 3. 分层数据访问接口

```typescript
// data/ 层提供统一接口

// 1. SessionRepository - 读取 JSONL 真相源
interface SessionRepository {
  readSession(sessionId: string): Promise<SessionSnapshot>;
  findLatestSession(projectDir: string): Promise<SessionInfo | null>;
  // 注意: 不写操作，JSONL 是只读的
}

// 2. CacheRepository - 管理派生缓存
interface CacheRepository {
  // 读写 AI summaries
  loadSummaries(sessionId: string, jsonlMtime: number): SummaryCache | null;
  saveSummaries(sessionId: string, data: SummaryCache): void;
  invalidate(sessionId: string): void;
  
  // 读写 evidence
  loadEvidence(sessionId: string): EvidenceData | null;
  saveEvidence(sessionId: string, explorationId: string, data: Evidence): void;
  deleteEvidence(sessionId: string, explorationId?: string): void;
}

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

// 4. NoteRepository - 管理笔记
interface NoteRepository {
  appendNote(date: string, note: NoteEntry): void;
  listRecent(limit: number): NoteEntry[];
}
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
  └── useExplorationSummaries.ts
      └── 调用: SessionService (读JSONL) + CacheService (读/写缓存)

services/ (服务层)
  ├── session/
  │   └── observer-session-service.ts
  │       └── 注入: SessionRepository (JSONL)
  ├── ai/
  │   └── exploration-summary-service.ts
  │       └── 注入: CacheRepository (runtime) + KnowledgeRepository (去重)
  └── wiki/
      └── persistence-service.ts
          └── 注入: KnowledgeRepository (knowledge-base)

data/ (数据层)
  ├── protocol/
  │   └── observer-protocol.ts (类型定义)
  ├── session/
  │   ├── repository.ts (JSONL 读取)
  │   └── cache-store.ts (runtime/evidence 读写)
  ├── wiki/
  │   ├── knowledge-repository.ts (知识库 CRUD)
  │   ├── cache-repository.ts (摘要缓存)
  │   └── evidence-repository.ts (evidence 管理)
  └── management/
      └── data-governance.ts (去重、清理、一致性检查)
```

## 6. 关键设计原则

1. **单一真相源**: JSONL 是唯一的派生数据来源
2. **分层隔离**: UI 层不直接访问文件系统
3. **写时治理**: 保存知识时进行去重和审核
4. **懒加载**: 缓存按需加载；new/continue 可自动重建，resume 仅回放
5. **可重建性**: 所有派生数据都可从 JSONL 重建
