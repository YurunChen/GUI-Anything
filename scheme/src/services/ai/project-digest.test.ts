import { describe, expect, it } from 'bun:test';
import type { ProjectDigest } from '../../data/protocol/evolution-types';
import { mergeDigest } from './project-digest';

const base: ProjectDigest = {
  headline: '确定性主旨',
  chapters: [
    { era: '起步', line: '搭骨架', span: '~1小时' },
    { era: '成型', line: '1 个里程碑', span: '~2天' },
  ],
  turningPoints: [{ title: 'A → B', why: '推进' }],
  outputs: [{ label: '里程碑', value: '2' }],
  learned: ['加功能笔记'],
  nextSteps: [],
};

describe('mergeDigest', () => {
  it('overlays headline, chapter lines (by era) and nextSteps; keeps reliable sections', () => {
    const raw = JSON.stringify({
      headline: '一个正在成型的可观测工具',
      chapters: [
        { era: '起步', line: '搭好了项目骨架与数据管线' },
        { era: '成型', line: '补齐核心功能' },
      ],
      nextSteps: ['补单测覆盖知识流', '为 KPI 接入真实 token'],
    });
    const out = mergeDigest(raw, base)!;
    expect(out.headline).toBe('一个正在成型的可观测工具');
    expect(out.chapters[0].line).toBe('搭好了项目骨架与数据管线');
    expect(out.chapters[0].span).toBe('~1小时'); // span stays deterministic
    expect(out.chapters[1].line).toBe('补齐核心功能');
    expect(out.nextSteps).toHaveLength(2);
    // reliable sections untouched
    expect(out.outputs).toBe(base.outputs);
    expect(out.turningPoints).toBe(base.turningPoints);
    expect(out.learned).toBe(base.learned);
  });

  it('keeps base chapter line when AI omits that era', () => {
    const raw = JSON.stringify({ headline: '只改主旨', chapters: [{ era: '起步', line: '只改第一章' }] });
    const out = mergeDigest(raw, base)!;
    expect(out.chapters[0].line).toBe('只改第一章');
    expect(out.chapters[1].line).toBe('1 个里程碑'); // untouched base
    expect(out.nextSteps).toEqual([]); // none supplied → base
  });

  it('extracts JSON from prose / fences', () => {
    const out = mergeDigest('结果：\n```json\n{"nextSteps":["收尾文档"]}\n```', base)!;
    expect(out.nextSteps).toEqual(['收尾文档']);
    expect(out.headline).toBe(base.headline);
  });

  it('returns null when nothing usable is present', () => {
    expect(mergeDigest('no json', base)).toBeNull();
    expect(mergeDigest(JSON.stringify({ foo: 1 }), base)).toBeNull();
    expect(mergeDigest(JSON.stringify({ nextSteps: [] }), base)).toBeNull();
  });
});
