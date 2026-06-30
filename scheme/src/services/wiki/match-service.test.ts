import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import type { KnowledgeEntry } from '../../data/wiki/knowledge-repository';
import {
  calculateRelevanceScore,
  DefaultWikiMatchService,
  isGenericQuery,
  requestSimilarity,
} from './match-service';

function makeEntry(overrides: Partial<KnowledgeEntry> = {}): KnowledgeEntry {
  return {
    id: 'C001',
    slug: 'project-overview',
    sessionId: 's1',
    explorationId: 'exp_1',
    type: 'context',
    request: '分析下当前的项目',
    content: 'GUI-Anything Flow Observer dual-pane project overview.',
    confidence: 0.85,
    tags: ['project-overview', 'proj:gui-anything'],
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('wiki match-service', () => {
  let originalRoot: string | undefined;

  beforeEach(() => {
    originalRoot = process.env.FLOW_ROOT_DIR;
    process.env.FLOW_ROOT_DIR = '/tmp/GUI-Anything';
  });

  afterEach(() => {
    if (originalRoot !== undefined) {
      process.env.FLOW_ROOT_DIR = originalRoot;
    } else {
      delete process.env.FLOW_ROOT_DIR;
    }
  });

  it('detects generic project-analysis queries', () => {
    expect(isGenericQuery('分析下当前的项目')).toBe(true);
    expect(isGenericQuery('review this codebase architecture')).toBe(true);
    expect(isGenericQuery('fix docker daemon connection')).toBe(false);
  });

  it('scores exact request similarity highly', () => {
    expect(requestSimilarity('分析下当前的项目', '分析下当前的项目')).toBe(1);
    expect(requestSimilarity('分析下当前项目', '分析下当前的项目')).toBe(1);
  });

  it('caps generic cross-request matches below perfect score', () => {
    const entry = makeEntry({
      request: '梳理 wiki 写入流程',
      tags: ['wiki', 'proj:other-project'],
    });
    const score = calculateRelevanceScore('分析下当前的项目', entry);
    expect(score).toBeLessThanOrEqual(0.65);
  });

  it('prefers same-project entries over other-project tags', () => {
    const sameProject = makeEntry({ tags: ['proj:gui-anything'] });
    const otherProject = makeEntry({
      id: 'C002',
      request: '分析下当前的项目',
      tags: ['proj:other-project'],
    });

    const sameScore = calculateRelevanceScore('分析下当前的项目', sameProject);
    const otherScore = calculateRelevanceScore('分析下当前的项目', otherProject);
    expect(sameScore).toBeGreaterThan(otherScore);
  });

  it('does not return exact request hits scoped to another project', () => {
    const service = new DefaultWikiMatchService({
      listMatchPoolSync: () => [
        makeEntry({
          request: '分析下当前的项目',
          tags: ['proj:other-project'],
        }),
      ],
    } as never);

    expect(service.searchByQuerySync('分析下当前的项目', 0.5)).toBeNull();
  });

  it('allows explicit global knowledge to match across projects', () => {
    const service = new DefaultWikiMatchService({
      listMatchPoolSync: () => [
        makeEntry({
          request: '分析下当前的项目',
          tags: ['scope:global'],
        }),
      ],
    } as never);

    expect(service.searchByQuerySync('分析下当前的项目', 0.5)?.entry.id).toBe('C001');
  });

  it('keeps legacy bare project-slug tags compatible with the current project', () => {
    const service = new DefaultWikiMatchService({
      listMatchPoolSync: () => [
        makeEntry({
          request: '分析下当前的项目',
          tags: ['gui-anything'],
        }),
      ],
    } as never);

    expect(service.searchByQuerySync('分析下当前的项目', 0.5)?.entry.id).toBe('C001');
  });

  it('matches project-analysis queries without filler particles', () => {
    const entry = makeEntry({ request: '分析下当前的项目', tags: ['proj:gui-anything'] });
    const score = calculateRelevanceScore('分析下当前项目', entry);
    expect(score).toBeGreaterThanOrEqual(0.5);
  });
});
