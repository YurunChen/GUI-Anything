import type { Exploration, FlowchartHint } from '../data/protocol/observer-protocol';

export interface GraphFingerprintInput {
  explorations: Exploration[];
  summaries: Record<string, string>;
  flowchartHints?: Record<string, FlowchartHint>;
  wikiPersistStatus?: Record<string, 'saved' | 'skipped' | 'failed' | 'pending'>;
}

export function buildGraphFingerprint(input: GraphFingerprintInput): string {
  const orderedExplorations = [...input.explorations].sort((a, b) => {
    const start = a.startedAt - b.startedAt;
    if (start !== 0) return start;
    return a.id.localeCompare(b.id);
  });
  const parts: string[] = [];
  for (const exploration of orderedExplorations) {
    parts.push(`${exploration.id}:${exploration.status}`);
    const summary = input.summaries[exploration.id];
    if (summary) parts.push(`summary:${exploration.id}:${summary}`);
    const hint = input.flowchartHints?.[exploration.id];
    if (hint) parts.push(`hint:${exploration.id}:${JSON.stringify(hint)}`);
    const wiki = input.wikiPersistStatus?.[exploration.id];
    if (wiki) parts.push(`wiki:${exploration.id}:${wiki}`);
  }
  return parts.join('|');
}
