/**
 * Wiki Agent structured decision schema.
 */

/** Agent / print JSON — main entries only (summaries are agent disk-only). */
export type WikiAgentEntryType = 'context' | 'entity';

export interface WikiAgentSections {
  summary: string;
  solution: string;
  commands?: string[];
}

export interface WikiAgentDecision {
  action: 'create' | 'update' | 'skip';
  target_id?: string;
  type: WikiAgentEntryType;
  slug: string;
  sections: WikiAgentSections;
  related_ids: string[];
  tags: string[];
  reason: string;
}

export function isWikiAgentDecision(value: unknown): value is WikiAgentDecision {
  if (!value || typeof value !== 'object') return false;
  const d = value as WikiAgentDecision;
  if (d.action !== 'create' && d.action !== 'update' && d.action !== 'skip') return false;
  if (typeof d.slug !== 'string' || !d.slug.trim()) return false;
  if (typeof d.reason !== 'string') return false;
  if (!d.sections || typeof d.sections.summary !== 'string') return false;
  if (typeof d.sections.solution !== 'string') return false;
  const validTypes: WikiAgentEntryType[] = ['context', 'entity'];
  if (!validTypes.includes(d.type as WikiAgentEntryType)) return false;
  if (d.action === 'update' && !d.target_id?.trim()) return false;
  return true;
}
