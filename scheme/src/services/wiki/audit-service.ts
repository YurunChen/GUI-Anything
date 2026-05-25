/**
 * Wiki audit filing — service wrapper over data-layer audit + log.
 */

import {
  fileKnowledgeAudit,
  type AuditSeverity,
  type KnowledgeAuditInput,
} from '../../data/wiki/knowledge-audit-service';
import { appendKnowledgeLog } from '../../data/wiki/knowledge-log-service';

export type { AuditSeverity, KnowledgeAuditInput };

export function fileWikiAudit(input: KnowledgeAuditInput): { path: string; id: string } {
  const result = fileKnowledgeAudit(input);
  appendKnowledgeLog({ op: 'audit', id: input.targetId, reason: input.severity ?? 'medium' });
  return result;
}
