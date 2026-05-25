import { describe, expect, it } from 'bun:test';
import {
  formatSlugForDisplay,
  formatKnowledgeTypeLabel,
  formatWikiContinuityLine,
  shouldShowRequest,
} from './WikiMatchCard';
import {
  formatKnowledgeExcerpt,
} from '../../../services/wiki/wiki-text-utils';
import { getObserverMessages } from '../i18n/observer-messages';

describe('formatKnowledgeExcerpt', () => {
  it('strips frontmatter and uses 摘要 section', () => {
    const raw = `---
id: "C001"
request: "分析项目"
tags:
  - "overview"
---
## 问题
原始问题

## 摘要
这是可读的摘要正文，不应显示 YAML。

## 上下文
更多细节
`;
    const excerpt = formatKnowledgeExcerpt(raw);
    expect(excerpt).toContain('可读的摘要正文');
    expect(excerpt).not.toContain('id:');
    expect(excerpt).not.toContain('原始问题');
  });

  it('ignores footer --- when frontmatter is unclosed (legacy files)', () => {
    const legacy = `---
id: "C001"
status: "draft"
## 问题
分析

## 摘要
这是摘要正文。

## 参考
- x

---

**注意**: 审核
`;
    const excerpt = formatKnowledgeExcerpt(legacy);
    expect(excerpt).toContain('摘要正文');
    expect(excerpt).not.toContain('审核');
  });
});

describe('shouldShowRequest', () => {
  it('hides request when it matches the timeline question', () => {
    expect(shouldShowRequest('分析项目结构', '分析项目结构')).toBe(false);
    expect(shouldShowRequest('  分析项目结构  ', '分析项目结构')).toBe(false);
  });

  it('shows request when it differs from the timeline question', () => {
    expect(shouldShowRequest('wiki 原始请求', '当前用户问题')).toBe(true);
  });

  it('hides empty request', () => {
    expect(shouldShowRequest('   ', 'question')).toBe(false);
  });
});

describe('formatKnowledgeTypeLabel', () => {
  it('resolves entity type in zh-Hans', () => {
    const labels = getObserverMessages('zh-Hans').wikiKnowledgeType;
    expect(formatKnowledgeTypeLabel('entity', labels)).toBe('实体');
  });
});

describe('formatWikiContinuityLine', () => {
  it('shows continues id, title, and score', () => {
    const messages = getObserverMessages('zh-Hans');
    const line = formatWikiContinuityLine({
      score: 0.87,
      entry: {
        id: 'C012',
        type: 'context',
        slug: 'gui-layering',
        request: '分层',
        content: '---\n## 摘要\nGUI 三层架构说明\n',
        tags: [],
        sessionId: 's',
        explorationId: 'e1',
      },
    }, messages);
    expect(line).toContain('接续 C012');
    expect(line).toContain('87%');
    expect(line).toContain('GUI');
  });
});

describe('formatSlugForDisplay', () => {
  it('truncates long slugs by display width', () => {
    const slug = 'project-analysis-gui-anything-flow-observer';
    expect(formatSlugForDisplay(slug, 40).length).toBeLessThan(slug.length);
    expect(formatSlugForDisplay(slug, 40)).toContain('project');
  });

  it('returns empty for blank slug', () => {
    expect(formatSlugForDisplay('  ', 80)).toBe('');
  });
});
