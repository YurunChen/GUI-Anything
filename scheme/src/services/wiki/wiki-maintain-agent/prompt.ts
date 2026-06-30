/**
 * Build Wiki Maintain Agent prompt from maintenance report.
 */

import type { WikiMaintenanceReport } from '../wiki-maintenance-report';
import {
  WIKI_MAINTAIN_MANIFEST_SCHEMA,
  type WikiMaintainManifest,
} from './manifest';

export const WIKI_MAINTAIN_SKILL_HEADER = `你是「知识库治理人」——同一 /llm-wiki skill 的 Phase 2（maintain）。

若任务含 digest / prior hit，先完成 Phase 1 ingest（create/update），再执行 Phase 2。
本任务为手动维护时通常仅 Phase 2；会话开始读 SCHEMA.md、index.md，再读下方维护报告。

## audit（优先）

1. 按 severity 处理 open audit：high → medium → low
2. 打开 target_id 对应条目，用 Anchor 摘录定位正文
3. 锚点失效 → defer（不要写入 audits_resolved）
4. 决策：accept / partial / reject；在 audit 文件末尾追加 # Resolution 后再列入 audits_resolved
5. 禁止删除 audit 文件（服务层移至 audit/resolved/）

## lint

修复报告中的 duplicate id/request、index 缺失等。

## compile

- files_moved：flat contexts/C*.md → contexts/{intent_key}/
- entries_merged：从页标注 merged_into，禁止 delete
- 桶内 ≥4 条且无 index.md → 可建 contexts/{intent_key}/index.md

原则：不删除 knowledge 条目；无工作则 skip。

## 禁止

- 写 sessions/、outputs/、index.md、log/
- 跳过 Phase 1 直接改结构（有 digest 时须先 ingest）

Agentic：先写完磁盘，最后**仅**输出一个 JSON 对象（无围栏）。`;

export function buildWikiMaintainSkillContext(report: WikiMaintenanceReport): string {
  return [
    WIKI_MAINTAIN_SKILL_HEADER,
    '',
    '---',
    '',
    report.summaryText,
    '',
    '---',
    '',
    'Read affected entry files under wiki/knowledge/ before editing.',
    'After disk writes, output ONLY one JSON manifest:',
    WIKI_MAINTAIN_MANIFEST_SCHEMA,
  ].join('\n');
}

export function buildWikiMaintainSkillPrompt(report: WikiMaintenanceReport): string {
  return [
    '/llm-wiki',
    '',
    '## Task: Phase 2 maintain (same /llm-wiki session after Phase 1 when applicable)',
    '',
    'Follow llm-wiki skill Phase 2 + knowledge-layout.md + maintenance-guide (compile/lint/audit).',
    '',
    buildWikiMaintainSkillContext(report),
  ].join('\n');
}

export type { WikiMaintainManifest };
