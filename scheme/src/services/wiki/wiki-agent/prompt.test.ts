import { describe, expect, it } from 'bun:test';
import { buildWikiAgentPrompt, buildWikiAgentSkillContext } from './prompt';
import { WIKI_AGENT_JSON_SCHEMA } from './skill-prompt';
import type { IntentDigest } from '../intent-digest-service';

const baseInput = {
  summary: {
    id: 'exp_1',
    request: '分析项目',
    summary: 'Short summary',
    commands: [],
    files: [],
    nodes: [],
    result: 'success' as const,
    duration: 0,
    tokens: 0,
    sessionId: 'sess',
  },
  priorHit: null,
  candidates: [],
};

describe('buildWikiAgentSkillContext', () => {
  it('does not include full decision JSON schema', () => {
    const text = buildWikiAgentSkillContext(baseInput);
    expect(text).not.toContain(WIKI_AGENT_JSON_SCHEMA);
    expect(text).not.toContain('"sections"');
    expect(text).not.toContain('只使用上述 JSON 契约输出');
    expect(text).toContain('manifest JSON');
  });

  it('includes intent_key bucket path when digest is present', () => {
    const digest: IntentDigest = {
      intentKey: 'project_design',
      nodeTitle: 'Wiki layout',
      sessionId: 'sess',
      explorations: [{
        explorationId: 'exp_1',
        request: '分析 wiki',
        summary: 'summary',
        commands: [],
      }],
      evidenceExcerpt: '',
      representativeQuestion: 'Wiki layout',
      combinedSummary: 'summary',
    };
    const text = buildWikiAgentSkillContext({ ...baseInput, digest });
    expect(text).toContain('knowledge/contexts/project_design/');
  });
});

describe('buildWikiAgentPrompt', () => {
  it('includes manifest JSON schema for print path', () => {
    const text = buildWikiAgentPrompt(baseInput);
    expect(text).toContain(WIKI_AGENT_JSON_SCHEMA);
    expect(text).toContain('files_written');
    expect(text).toContain('Output only the JSON manifest below.');
  });
});
