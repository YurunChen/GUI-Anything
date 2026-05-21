# 数据流转链路（新格式）

## 完整数据流

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              应用层 (app/)                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  useExplorationSummaries.ts                                                 │
│  ├── 调用: DefaultExplorationSummaryService                                 │
│  │   ├── hydrateFromCache() → wiki/runtime/{session}-summaries.json        │
│  │   └── hydrateFromWiki() → KnowledgeRepository.listAll()                 │
│  │                                                          ↓              │
│  └── 调用: generateMissing()（仅 allowRegen=true）→ saveSummary()          │
│                                    ↓                                        │
│                             wiki/runtime/{session}-summaries.json          │
│                                                                             │
│  useWikiPersistence.ts                                                      │
│  └── 调用: DefaultWikiPersistenceService.persistCompleted()                 │
│                          ↓                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                             服务层 (services/)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ai/exploration-summary-service.ts                                          │
│  └── 使用: KnowledgeRepository (新)                                         │
│                                                                             │
│  wiki/persistence-service.ts                                                │
│  ├── 保存 Evidence: EvidenceRepository.saveEvidence()                      │
│  │                      ↓                                                   │
│  │           wiki/evidence/{sessionId}.json (聚合格式)                       │
│  │                                                                          │
│  └── 保存 Knowledge: KnowledgeRepository.save()                            │
│                         ↓                                                   │
│           wiki/knowledge-base/{type}/{id}-{slug}.md                        │
│                                                                             │
│  wiki/auto-extractor.ts                                                     │
│  └── 生成 WikiExtractionResult → 调用 Repository 保存                        │
│                                                                             │
│  ai/summary-cache.ts                                                        │
│  └── 直接文件操作 → wiki/runtime/{session}-summaries.json                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                              数据层 (data/)                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  wiki/knowledge-repository.ts                                               │
│  ├── 读取: knowledge-base/{type}/*.md                                       │
│  └── 保存: knowledge-base/{type}/{id}-{slug}.md                             │
│                                                                             │
│  wiki/evidence-repository.ts                                                │
│  ├── 读取: evidence/{sessionId}.json (聚合)                                  │
│  └── 保存: evidence/{sessionId}.json (聚合)                                  │
│                                                                             │
│  (已废弃) wiki/repository.ts - 标记为 @deprecated                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 新格式目录结构

```
wiki/
├── knowledge-base/                 ← 知识库（长期）
│   ├── errors/                    ← E001-xxx.md
│   ├── snippets/                   ← S001-xxx.md
│   ├── decisions/                  ← D001-xxx.md
│   └── contexts/                   ← C001-xxx.md
├── evidence/                       ← 原始数据（聚合）
│   └── {sessionId}.json            ← { exp_1: {...}, exp_2: {...} }
├── runtime/                        ← AI 摘要缓存（临时）
│   └── {sessionId}-summaries.json  ← { summaries: { exp_1: {...} } }
└── daily-notes/                    ← 灵感笔记
    └── 2025-04-27.md
```

## 已废弃/删除的旧代码

| 文件/目录 | 状态 | 说明 |
|----------|------|------|
| `wiki/knowledge-base/*.md` (根目录) | 已删除 | 旧格式文件已清理 |
| `wiki/evidence/*/` (子目录) | 已删除 | 旧格式子目录已清理 |
| `data/wiki/repository.ts` | 已删除 | 旧 WikiRepository/FileWikiRepository 写入口已移除 |
| `data/wiki/repository.test.ts` | 已删除 | 旧测试文件 |

## 更新后的导入链

```typescript
// 应用层
import { DefaultExplorationSummaryService } from 'services/ai/exploration-summary-service';
import { DefaultWikiPersistenceService } from 'services/wiki/persistence-service';

// 服务层
import { KnowledgeRepository } from 'data/wiki/knowledge-repository';
import { EvidenceRepository } from 'data/wiki/evidence-repository';

// 不再存在
// import { FileWikiRepository } from 'data/wiki/repository'; ❌ 已删除
```

## 重启验证清单

1. [ ] 删除所有旧格式数据
2. [ ] 重启 observer
3. [ ] 执行一个 exploration
4. [ ] 检查 `wiki/knowledge-base/{type}/` 有新格式文件
5. [ ] 检查 `wiki/evidence/{session}.json` 存在（无子目录）
6. [ ] 检查 `wiki/runtime/{session}-summaries.json` 存在
