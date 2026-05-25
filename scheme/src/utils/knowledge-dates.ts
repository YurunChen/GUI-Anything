/**
 * Canonical date fields for wiki/knowledge frontmatter (ISO-8601 UTC).
 */

export interface KnowledgeDateFields {
  /** ISO-8601 UTC */
  created: string;
  updated: string;
}

export function formatKnowledgeDates(at: Date = new Date()): KnowledgeDateFields {
  const iso = at.toISOString();
  return {
    created: iso,
    updated: iso,
  };
}

function upsertYamlLine(yaml: string, key: string, value: string): string {
  const re = new RegExp(`^${key}:\\s*.*$`, 'm');
  const line = `${key}: "${value}"`;
  if (re.test(yaml)) {
    return yaml.replace(re, line);
  }
  return `${yaml.trimEnd()}\n${line}`;
}

/** Inject or refresh date lines in a frontmatter YAML block (without --- wrappers). */
export function applyKnowledgeDatesToYaml(
  yaml: string,
  mode: 'create' | 'update',
  at: Date = new Date(),
): string {
  const d = formatKnowledgeDates(at);
  let out = yaml.trimEnd();

  if (mode === 'create' || !/^created:/m.test(out)) {
    out = upsertYamlLine(out, 'created', d.created);
  }

  out = upsertYamlLine(out, 'updated', d.updated);

  return out;
}
