import { resolveProjectTag } from '../env';
import type { KnowledgeEntry } from './knowledge-repository';

const PROJECT_TAG_PREFIX = 'proj:';
const GLOBAL_SCOPE_TAGS = new Set([
  'scope:global',
  'scope:shared',
  'proj:global',
]);

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

function uniqueTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of tags.map((t) => t.trim()).filter(Boolean)) {
    const key = normalizeTag(tag);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

export function projectSlugFromTag(projectTag: string = resolveProjectTag()): string {
  const normalized = normalizeTag(projectTag);
  return normalized.startsWith(PROJECT_TAG_PREFIX)
    ? normalized.slice(PROJECT_TAG_PREFIX.length)
    : normalized;
}

export function isGlobalKnowledgeTag(tag: string): boolean {
  return GLOBAL_SCOPE_TAGS.has(normalizeTag(tag));
}

export function isGlobalKnowledge(tags: readonly string[] | undefined): boolean {
  return (tags ?? []).some(isGlobalKnowledgeTag);
}

export function hasProjectTag(tags: readonly string[] | undefined): boolean {
  return (tags ?? []).some((tag) => normalizeTag(tag).startsWith(PROJECT_TAG_PREFIX));
}

export function hasCurrentProjectTag(
  tags: readonly string[] | undefined,
  currentProjectTag: string = resolveProjectTag(),
): boolean {
  const current = normalizeTag(currentProjectTag);
  return (tags ?? []).some((tag) => normalizeTag(tag) === current);
}

function hasLegacyProjectSlugTag(
  tags: readonly string[] | undefined,
  currentProjectTag: string,
): boolean {
  const slug = projectSlugFromTag(currentProjectTag);
  return (tags ?? []).some((tag) => normalizeTag(tag) === slug);
}

/**
 * Shared wiki safety rule:
 * - current-project entries match the current project;
 * - explicit global/shared entries may match anywhere;
 * - legacy entries tagged with the bare project slug remain usable;
 * - other-project or unscoped entries are excluded from prior-hit search/dedup.
 */
export function isKnowledgeProjectCompatible(
  entry: Pick<KnowledgeEntry, 'tags'>,
  currentProjectTag: string = resolveProjectTag(),
): boolean {
  const tags = entry.tags ?? [];
  if (isGlobalKnowledge(tags)) return true;
  if (hasCurrentProjectTag(tags, currentProjectTag)) return true;
  return !hasProjectTag(tags) && hasLegacyProjectSlugTag(tags, currentProjectTag);
}

export function filterProjectCompatibleKnowledge<T extends Pick<KnowledgeEntry, 'tags'>>(
  entries: T[],
  currentProjectTag: string = resolveProjectTag(),
): T[] {
  return entries.filter((entry) => isKnowledgeProjectCompatible(entry, currentProjectTag));
}

export function ensureKnowledgeScopeTags(
  tags: readonly string[] | undefined,
  currentProjectTag: string = resolveProjectTag(),
): string[] {
  const out = uniqueTags([...(tags ?? [])]);
  if (isGlobalKnowledge(out) || hasCurrentProjectTag(out, currentProjectTag)) {
    return out;
  }
  return uniqueTags([...out, currentProjectTag]);
}
