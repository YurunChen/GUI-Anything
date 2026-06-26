import type { ExplorationNode } from '../../data/protocol/observer-protocol';
import { getSummaryMessages } from '../../constants/summary-messages';

/** L1 — rule-based summary from JSONL nodes (no LLM). Used in replay fallback. */
export function buildExplorationExcerptSummary(
  question: string,
  nodes: ExplorationNode[],
): string {
  const m = getSummaryMessages();
  const toolCount = nodes.filter((node) => node.type === 'tool').length;
  const errorCount = nodes.filter((node) => node.status === 'error' || node.type === 'error').length;
  const responseCount = nodes.filter((node) => node.type === 'response').length;
  const thinkingCount = nodes.filter((node) => node.type === 'thinking').length;
  const resultCount = nodes.filter((node) => node.type === 'result').length;
  const latestOutputNode = [...nodes].reverse().find((node) =>
    node.type === 'response' || node.type === 'result',
  );
  const outputPreview = (latestOutputNode?.label || '').trim().slice(0, 48);

  if (toolCount === 0 && responseCount === 0 && thinkingCount === 0 && resultCount === 0 && errorCount === 0) {
    return m.excerptInsufficient;
  }
  if (outputPreview) {
    return m.excerptWithOutput(question, toolCount, outputPreview, errorCount);
  }
  return m.excerptWithTools(question, toolCount, responseCount);
}
