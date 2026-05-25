/**
 * Validate Wiki Agent JSON output from Claude subagent.
 */

import { extractJsonFromText, type ValidationResult } from '../../ai/structured-output';
import type { WikiAgentDecision } from './schema';
import type { WikiAgentEntryType } from './schema';

const VALID_TYPES: WikiAgentEntryType[] = ['context', 'entity'];

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

export function validateWikiAgentDecision(raw: string): ValidationResult<WikiAgentDecision> {
  const jsonText = extractJsonFromText(raw);
  if (!jsonText) {
    return { success: false, error: 'No JSON found', fallbackReason: 'json_not_found' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'parse error',
      fallbackReason: 'json_parse_error',
    };
  }

  if (!isObject(parsed)) {
    return { success: false, error: 'Not an object', fallbackReason: 'not_an_object' };
  }

  const action = parsed.action;
  if (action !== 'create' && action !== 'update' && action !== 'skip') {
    return { success: false, error: 'Invalid action', fallbackReason: 'invalid_action' };
  }

  if (action === 'skip') {
    return {
      success: true,
      data: {
        action: 'skip',
        type: 'context',
        slug: 'skip',
        sections: { summary: '', solution: '' },
        related_ids: [],
        tags: [],
        reason: isNonEmptyString(parsed.reason) ? parsed.reason.trim() : 'skip',
      },
    };
  }

  const type = parsed.type;
  if (!VALID_TYPES.includes(type as WikiAgentEntryType)) {
    return { success: false, error: 'Invalid type', fallbackReason: 'invalid_type' };
  }

  if (!isNonEmptyString(parsed.slug)) {
    return { success: false, error: 'Missing slug', fallbackReason: 'missing_slug' };
  }

  const sections = parsed.sections;
  if (!isObject(sections) || !isNonEmptyString(sections.summary) || !isNonEmptyString(sections.solution)) {
    return { success: false, error: 'Invalid sections', fallbackReason: 'invalid_sections' };
  }

  const targetId = typeof parsed.target_id === 'string' ? parsed.target_id.trim() : '';
  if (action === 'update' && !targetId) {
    return { success: false, error: 'update requires target_id', fallbackReason: 'missing_target_id' };
  }

  const related = Array.isArray(parsed.related_ids)
    ? parsed.related_ids.filter((id): id is string => typeof id === 'string').slice(0, 8)
    : [];
  const tags = Array.isArray(parsed.tags)
    ? parsed.tags.filter((t): t is string => typeof t === 'string').slice(0, 8)
    : [];

  return {
    success: true,
    data: {
      action,
      target_id: targetId || undefined,
      type: type as WikiAgentEntryType,
      slug: parsed.slug.trim(),
      sections: {
        summary: sections.summary.trim(),
        solution: sections.solution.trim(),
        commands: Array.isArray(sections.commands)
          ? sections.commands.filter((c): c is string => typeof c === 'string').slice(0, 3)
          : undefined,
      },
      related_ids: related,
      tags,
      reason: isNonEmptyString(parsed.reason) ? parsed.reason.trim() : action,
    },
  };
}
