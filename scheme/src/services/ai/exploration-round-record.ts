/**
 * Rule-based Hero lines when Summary LLM is skipped — Apple-style distill, not archival paste.
 */

import type { ExplorationSummaryNode } from './flow-summaries';
import { getObserverMessages } from '../../app/ui/i18n/observer-messages';

function latestAssistantText(nodes: ExplorationSummaryNode[]): string {
  const latest = [...nodes].reverse().find(
    (n) => n.type === 'response' || n.type === 'result',
  );
  return latest?.label?.trim() || '';
}

/** First sentence / line, capped — for Hero only. */
export function distillAssistantGist(text: string, maxLen = 96): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t) return '';
  const first = t.split(/[.!?。！？\n]/)[0]?.trim() || t;
  if (first.length <= maxLen) return first;
  return `${first.slice(0, maxLen - 1)}…`;
}

export function isGenericAssistantGreeting(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (/what can i help/i.test(t)) return true;
  if (/^(hello|hi|hey|你好|您好)[!.?\s，]/i.test(t) && t.length < 120) return true;
  return false;
}

/** Full assistant reply for solution_detail / wiki, not for Hero. */
export function formatAssistantReplyExcerpt(nodes: ExplorationSummaryNode[], maxLen = 1200): string {
  const text = latestAssistantText(nodes);
  if (!text) return '';
  const m = getObserverMessages();
  if (text.length <= maxLen) return m.assistantReplyLine(text);
  return m.assistantReplyLine(`${text.slice(0, maxLen - 1)}…`);
}

/** Hero: one distilled flow line (fallback when LLM unavailable). */
export function buildExplorationRoundRecord(
  question: string,
  nodes: ExplorationSummaryNode[],
): string {
  const m = getObserverMessages();
  const q = question.trim();
  const toolCount = nodes.filter((n) => n.type === 'tool').length;
  const reply = latestAssistantText(nodes);
  const gist = distillAssistantGist(reply);

  if (!reply && toolCount === 0 && !q) {
    return m.calmNoSummary;
  }

  if (gist && !isGenericAssistantGreeting(reply)) {
    return gist;
  }

  if (toolCount > 0) {
    return gist ? m.roundDistillWithTools(gist, toolCount) : m.roundDistillInProgress;
  }

  if (/^(hello|hi|hey|你好|您好)$/i.test(q)) {
    return m.trivialGreetingDistill;
  }

  if (q) {
    return m.roundDistillPending(q);
  }

  return m.calmNoSummary;
}
