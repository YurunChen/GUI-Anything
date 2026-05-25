/**
 * Fixed session intent_key vocabulary — Summary Agent must pick from this list
 * (except system greeting). Stabilizes wiki buckets and pivot boundaries.
 */

export interface SessionIntentKeyDef {
  key: string;
  labelZh: string;
  /** One-line guidance for Summary Agent routing */
  when: string;
  /** When this intent bucket closes (pivot/sweep), run Wiki Curator */
  wikiCurateOnClose: boolean;
}

/** System-only; not in pivot catalog for real tasks */
export const SESSION_INTENT_GREETING = 'greeting' as const;

/** User-task keys (closed set) */
export const SESSION_INTENT_KEYS: readonly SessionIntentKeyDef[] = [
  {
    key: 'explore',
    labelZh: '理解代码',
    when: '读仓库、扫目录、弄清模块/数据流，尚未动手改',
    wikiCurateOnClose: false,
  },
  {
    key: 'project_design',
    labelZh: '项目与设计',
    when: '架构、分层、职责边界、可优化点、设计评审、README/data-flow/契约与方案（含「分析项目」「还有哪些可优化」）',
    wikiCurateOnClose: true,
  },
  {
    key: 'implement',
    labelZh: '实现功能',
    when: '写/改代码或文档文件落地、补功能、按方案执行（含改 markdown/提示词文件）',
    wikiCurateOnClose: true,
  },
  {
    key: 'refactor',
    labelZh: '重构整理',
    when: '去冗余、拆模块、命名/结构整理，不以修 bug 为主',
    wikiCurateOnClose: true,
  },
  {
    key: 'debug',
    labelZh: '排错修复',
    when: '报错、失败用例、行为不符、定位根因并修',
    wikiCurateOnClose: true,
  },
  {
    key: 'test_verify',
    labelZh: '测试验收',
    when: '单测、集成测、手验清单、CI/回归',
    wikiCurateOnClose: false,
  },
  {
    key: 'devops',
    labelZh: '工具与运行',
    when: 'flow-run、脚本、环境变量、构建、部署、Observer/终端',
    wikiCurateOnClose: true,
  },
  {
    key: 'research',
    labelZh: '调研方案',
    when: '文献/竞品/实验设计、方法选型，非直接改本仓库',
    wikiCurateOnClose: true,
  },
  {
    key: 'general',
    labelZh: '其它任务',
    when: '无法归入以上任一域；能归则禁止用本键',
    wikiCurateOnClose: false,
  },
] as const;

export type SessionIntentTaskKey = (typeof SESSION_INTENT_KEYS)[number]['key'];

const TASK_KEY_SET = new Set<string>(SESSION_INTENT_KEYS.map((item) => item.key));

const ALIASES: Record<string, SessionIntentTaskKey> = {
  project_analysis: 'project_design',
  project_design_overview: 'project_design',
  design_review: 'project_design',
  optimization: 'project_design',
  docs_wiki: 'project_design',
  wiki: 'project_design',
  wiki_design: 'project_design',
  wiki_intent_curator: 'project_design',
  documentation: 'project_design',
  coding: 'implement',
  feature: 'implement',
  fix: 'debug',
  bugfix: 'debug',
  testing: 'test_verify',
  ci: 'test_verify',
  tooling: 'devops',
  flow: 'devops',
  observer: 'devops',
};

/** Default keys that trigger Wiki Curator when bucket closes */
export const DEFAULT_WIKI_CURATE_INTENT_KEYS: readonly SessionIntentTaskKey[] = SESSION_INTENT_KEYS
  .filter((item) => item.wikiCurateOnClose)
  .map((item) => item.key);

function parseWikiCurateIntentKeysFromEnv(): Set<string> | null {
  const raw = (process.env.FLOW_WIKI_CURATE_INTENTS || '').trim();
  if (!raw) return null;
  const keys = raw.split(/[,;\s]+/).map((part) => normalizeSessionIntentKey(part)).filter(Boolean);
  return new Set(keys);
}

/** Whether closing this intent bucket should invoke Wiki Curator (pivot / session sweep). */
export function shouldCurateWikiForIntent(intentKey: string): boolean {
  const normalized = normalizeSessionIntentKey(intentKey);
  if (normalized === SESSION_INTENT_GREETING) return false;
  const fromEnv = parseWikiCurateIntentKeysFromEnv();
  if (fromEnv) return fromEnv.has(normalized);
  return DEFAULT_WIKI_CURATE_INTENT_KEYS.includes(normalized as SessionIntentTaskKey);
}

/** Markdown block injected into Summary Agent prompt */
export function formatSessionIntentKeyCatalogForPrompt(): string {
  const lines = SESSION_INTENT_KEYS.map((item) => {
    const wikiTag = item.wikiCurateOnClose ? ' · **可沉淀**' : '';
    return `- \`${item.key}\` — ${item.labelZh}：${item.when}${wikiTag}`;
  });
  return [
    '【固定 intent_key 词表 — 只能从中选一】',
    `- 寒暄/无任务：\`${SESSION_INTENT_GREETING}\`（仅 idle，不沉淀）`,
    ...lines,
    '- 标 **可沉淀** 的 intent 在 pivot / session 结束时才会尝试 Wiki 落盘；其余只积累 bucket，关闭时 skip。',
    '- **禁止**自造未列出键；pivot 时换到词表中**另一项**。',
    '- **node_title** 仍自由（8–18 字），表达本轮具体子目标。',
  ].join('\n');
}

/** Normalize model output to a known task key; greeting preserved */
export function normalizeSessionIntentKey(raw: string): string {
  const trimmed = raw.trim().toLowerCase().replace(/\s+/g, '_');
  if (!trimmed) return 'general';
  if (trimmed === SESSION_INTENT_GREETING) return SESSION_INTENT_GREETING;
  if (TASK_KEY_SET.has(trimmed)) return trimmed;
  if (ALIASES[trimmed]) return ALIASES[trimmed];
  const prefix = SESSION_INTENT_KEYS.find((item) => trimmed.startsWith(`${item.key}_`));
  if (prefix) return prefix.key;
  return 'general';
}

export function isSessionIntentTaskKey(key: string): boolean {
  return TASK_KEY_SET.has(key) || key === SESSION_INTENT_GREETING;
}

export function isGreetingIntentKey(key: string): boolean {
  return normalizeSessionIntentKey(key) === SESSION_INTENT_GREETING;
}

const SESSION_INTENT_LABEL_EN: Record<SessionIntentTaskKey, string> = {
  explore: 'Explore',
  project_design: 'Design',
  implement: 'Implement',
  refactor: 'Refactor',
  debug: 'Debug',
  test_verify: 'Verify',
  devops: 'DevOps',
  research: 'Research',
  general: 'General',
};

/** Human-readable intent badge for Observer chrome (null for greeting / idle). */
export function sessionIntentDisplayLabel(
  key: string,
  locale: 'en' | 'zh-Hans' = 'en',
): string | null {
  const normalized = normalizeSessionIntentKey(key);
  if (normalized === SESSION_INTENT_GREETING) return null;
  const def = SESSION_INTENT_KEYS.find((item) => item.key === normalized);
  if (!def) return normalized.replace(/_/g, ' ');
  if (locale === 'zh-Hans') return def.labelZh;
  return SESSION_INTENT_LABEL_EN[normalized as SessionIntentTaskKey]
    ?? normalized.replace(/_/g, ' ');
}
