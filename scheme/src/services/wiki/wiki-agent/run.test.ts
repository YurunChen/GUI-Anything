import { afterEach, describe, expect, it } from 'bun:test';
import { resolveWikiDecision, resolveWikiModel, shouldRuleCreateFromDigest } from './run';
import type { IntentDigest } from '../intent-digest-service';
import type { ExplorationSummary } from '../../../data/protocol/wiki-types';

function makeDigest(overrides: Partial<IntentDigest> = {}): IntentDigest {
  return {
    intentKey: 'project_design',
    nodeTitle: '介绍整个项目功能',
    sessionId: 's1',
    explorations: [
      {
        explorationId: 'exp_1',
        request: '介绍整个项目功能',
        summary: '梳理了观察者与 wiki 管线的整体结构。',
        solutionDetail: '从 flow-run 启动到 summary→wiki 的端到端链路。',
        commands: ['bun run src/main.ts --live'],
      },
    ],
    evidenceExcerpt: '',
    representativeQuestion: '介绍整个项目功能',
    combinedSummary: '### Turn 1 (exp_1)\n梳理了观察者与 wiki 管线的整体结构。',
    ...overrides,
  };
}

function makeSummary(overrides: Partial<ExplorationSummary> = {}): ExplorationSummary {
  return {
    id: 'exp_1',
    request: '介绍整个项目功能',
    summary: '梳理了观察者与 wiki 管线的整体结构。',
    commands: ['bun run src/main.ts --live'],
    files: [],
    nodes: [],
    result: 'success',
    duration: 0,
    tokens: 0,
    sessionId: 's1',
    persistMeta: {
      solution_detail: '从 flow-run 启动到 summary→wiki 的端到端链路。',
      tags: ['intent:project_design'],
      should_persist: true,
      type: 'context',
      confidence: 0.75,
      reason: 'intent_digest:project_design',
    },
    ...overrides,
  };
}

const ORIGINAL_RULES_CREATE = process.env.FLOW_WIKI_RULES_CREATE;
const ORIGINAL_WIKI_MODEL = process.env.FLOW_WIKI_MODEL;
const ORIGINAL_CLAUDE_MODEL = process.env.CLAUDE_MODEL;

afterEach(() => {
  restoreEnv('FLOW_WIKI_RULES_CREATE', ORIGINAL_RULES_CREATE);
  restoreEnv('FLOW_WIKI_MODEL', ORIGINAL_WIKI_MODEL);
  restoreEnv('CLAUDE_MODEL', ORIGINAL_CLAUDE_MODEL);
});

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

describe('resolveWikiDecision — digest rule-create', () => {
  it('creates a draft page from a digest when no prior hit (default)', () => {
    delete process.env.FLOW_WIKI_RULES_CREATE;
    const decision = resolveWikiDecision({
      summary: makeSummary(),
      priorHit: null,
      digest: makeDigest(),
    });
    expect(decision?.action).toBe('create');
    expect(decision?.type).toBe('context');
    expect(decision?.slug.length).toBeGreaterThan(0);
    expect(decision?.slug).not.toBe('skip');
    expect(decision?.sections.summary).toContain('整体结构');
    expect(decision?.sections.solution).toContain('端到端');
    expect(decision?.reason).toBe('rule_create_from_digest:project_design');
    expect(decision?.tags).toContain('intent:project_design');
  });

  // Slug must satisfy KnowledgeRepository's SAFE_SLUG_RE (ASCII, no underscores), or the
  // create is rejected downstream with reason 'invalid_slug'.
  const SAFE_SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

  it('falls back to a SAFE_SLUG_RE-valid intent slug when title has no usable ASCII chars', () => {
    const decision = resolveWikiDecision({
      summary: makeSummary(),
      priorHit: null,
      digest: makeDigest({ nodeTitle: '---', representativeQuestion: '   ' }),
    });
    expect(decision?.action).toBe('create');
    expect(decision?.slug).toMatch(SAFE_SLUG_RE);
    expect(decision?.slug.startsWith('project-design-')).toBe(true);
  });

  it('produces a SAFE_SLUG_RE-valid slug for all-CJK titles', () => {
    const decision = resolveWikiDecision({
      summary: makeSummary(),
      priorHit: null,
      digest: makeDigest({ nodeTitle: '项目设计概览', representativeQuestion: '项目设计概览' }),
    });
    expect(decision?.action).toBe('create');
    expect(decision?.slug).toMatch(SAFE_SLUG_RE);
  });

  it('keeps ASCII words from mixed-language titles', () => {
    const decision = resolveWikiDecision({
      summary: makeSummary(),
      priorHit: null,
      digest: makeDigest({ nodeTitle: 'GUI-Anything 项目设计概览' }),
    });
    expect(decision?.slug).toBe('gui-anything');
  });

  it('skips when FLOW_WIKI_RULES_CREATE=0', () => {
    process.env.FLOW_WIKI_RULES_CREATE = '0';
    const decision = resolveWikiDecision({
      summary: makeSummary(),
      priorHit: null,
      digest: makeDigest(),
    });
    expect(decision?.action).toBe('skip');
    expect(decision?.reason).toBe('skill_only_no_prior');
  });
});

describe('shouldRuleCreateFromDigest', () => {
  it('defaults to true', () => {
    delete process.env.FLOW_WIKI_RULES_CREATE;
    expect(shouldRuleCreateFromDigest()).toBe(true);
  });

  it('is false when explicitly disabled', () => {
    process.env.FLOW_WIKI_RULES_CREATE = 'false';
    expect(shouldRuleCreateFromDigest()).toBe(false);
  });
});

describe('resolveWikiModel', () => {
  it('defaults to sonnet when no env set', () => {
    delete process.env.FLOW_WIKI_MODEL;
    delete process.env.CLAUDE_MODEL;
    expect(resolveWikiModel()).toBe('sonnet');
  });

  it('prefers FLOW_WIKI_MODEL', () => {
    process.env.FLOW_WIKI_MODEL = 'opus';
    expect(resolveWikiModel()).toBe('opus');
  });
});
