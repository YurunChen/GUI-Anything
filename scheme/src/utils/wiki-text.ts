/**
 * Wiki markdown helpers — shared by data mappers and UI.
 */

import { formatFlowText } from './flow-text';
import { getObserverMessages } from '../app/ui/i18n/observer-messages';

export function stripWikiFrontmatter(raw: string): string {
  if (!raw.startsWith('---\n')) return raw;
  const firstHeading = raw.search(/\n## /);
  const closeIdx = raw.indexOf('\n---\n', 4);
  if (closeIdx >= 0 && (firstHeading < 0 || closeIdx < firstHeading)) {
    return raw.slice(closeIdx + 5);
  }
  if (firstHeading >= 0) {
    return raw.slice(firstHeading + 1);
  }
  return raw;
}

export function formatKnowledgeExcerpt(
  raw: string,
  maxChars = 240,
  messages: ReturnType<typeof getObserverMessages> = getObserverMessages(),
): string {
  let body = stripWikiFrontmatter(raw.replace(/^﻿/, ''));

  const sectionPatterns = [
    /## 摘要\s*\n([\s\S]*?)(?=\n## |\n---\s*$|$)/,
    /## 解决方案\s*\n([\s\S]*?)(?=\n## |\n---\s*$|$)/,
    /## 问题\s*\n([\s\S]*?)(?=\n## |\n---\s*$|$)/,
  ];
  for (const pattern of sectionPatterns) {
    const hit = body.match(pattern);
    if (hit?.[1]?.trim()) {
      body = hit[1].trim();
      break;
    }
  }

  body = body
    .replace(/```[\s\S]*?```/g, ' [code] ')
    .replace(/^#+\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\n+/g, ' ')
    .trim();

  if (!body) return messages.wikiExcerptEmpty;
  const formatted = formatFlowText(body);
  if (formatted.length <= maxChars) return formatted;
  return `${formatted.slice(0, maxChars - 1)}…`;
}
