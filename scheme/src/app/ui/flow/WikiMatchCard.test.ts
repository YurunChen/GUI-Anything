import { describe, expect, it } from 'bun:test';
import { shouldShowRequest } from './WikiMatchCard';
import {
  formatKnowledgeExcerpt,
} from '../../../utils/wiki-text';

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
