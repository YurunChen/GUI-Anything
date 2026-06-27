import { describe, expect, it } from 'bun:test';
import {
  inferIntentKeyFromText,
  isGreetingRequest,
  synthesizeFlowchartHint,
} from './intent-infer';
import { SESSION_INTENT_GREETING } from '../../constants/session-intent-keys';

describe('isGreetingRequest', () => {
  it('detects pure greetings (cn + en)', () => {
    expect(isGreetingRequest('你好')).toBe(true);
    expect(isGreetingRequest('hello')).toBe(true);
    expect(isGreetingRequest('hi!')).toBe(true);
    expect(isGreetingRequest('thanks')).toBe(true);
  });

  it('rejects real tasks that merely start politely', () => {
    expect(isGreetingRequest('你好，帮我修复这个报错')).toBe(false);
    expect(isGreetingRequest('hello, please add a button')).toBe(false);
    expect(isGreetingRequest('')).toBe(false);
  });
});

describe('inferIntentKeyFromText', () => {
  it('maps debug keywords', () => {
    expect(inferIntentKeyFromText('这里报错了，帮我修复')).toBe('debug');
    expect(inferIntentKeyFromText('fix this bug please')).toBe('debug');
  });

  it('maps implement keywords', () => {
    expect(inferIntentKeyFromText('帮我新增一个登录功能')).toBe('implement');
    expect(inferIntentKeyFromText('add a new endpoint')).toBe('implement');
  });

  it('maps project_design keywords', () => {
    expect(inferIntentKeyFromText('介绍整个项目的功能与架构')).toBe('project_design');
  });

  it('maps explore keywords', () => {
    expect(inferIntentKeyFromText('这个函数在哪里定义')).toBe('explore');
  });

  it('returns greeting only for pure greetings', () => {
    expect(inferIntentKeyFromText('你好')).toBe(SESSION_INTENT_GREETING);
  });

  it('keeps continuity with prior real intent when no keyword matches', () => {
    expect(inferIntentKeyFromText('继续', 'refactor')).toBe('refactor');
  });

  it('falls back to general when nothing matches and no prior', () => {
    expect(inferIntentKeyFromText('继续')).toBe('general');
  });

  it('ignores greeting as a prior intent for continuity', () => {
    expect(inferIntentKeyFromText('继续', SESSION_INTENT_GREETING)).toBe('general');
  });
});

describe('synthesizeFlowchartHint', () => {
  it('produces a usable hint for a real task with no prior', () => {
    const hint = synthesizeFlowchartHint({ question: '帮我修复登录报错' });
    expect(hint.intentKey).toBe('debug');
    expect(hint.nodeTitle.length).toBeGreaterThan(0);
    expect(hint.dropFromChart).toBe(false);
    expect(hint.titleDelta).toBe('pivot');
    expect(hint.titleDeltaNote).toContain('auto-inferred');
    expect(hint.nodeId).toBe('auto_debug');
  });

  it('marks continue when intent matches the prior real intent', () => {
    const hint = synthesizeFlowchartHint({
      question: 'fix another bug',
      priorIntentKey: 'debug',
    });
    expect(hint.intentKey).toBe('debug');
    expect(hint.titleDelta).toBe('continue');
    expect(hint.parentId).toBeNull();
  });

  it('marks pivot and sets parentId when intent differs from prior', () => {
    const hint = synthesizeFlowchartHint({
      question: '新增一个功能',
      priorIntentKey: 'debug',
    });
    expect(hint.intentKey).toBe('implement');
    expect(hint.titleDelta).toBe('pivot');
    expect(hint.parentId).toBe('debug');
  });

  it('marks greeting as idle and drops it from chart', () => {
    const hint = synthesizeFlowchartHint({ question: '你好' });
    expect(hint.intentKey).toBe(SESSION_INTENT_GREETING);
    expect(hint.titleDelta).toBe('idle');
    expect(hint.dropFromChart).toBe(true);
  });

  it('caps node title length', () => {
    const long = '请帮我'.repeat(40);
    const hint = synthesizeFlowchartHint({ question: long, nodeTitleMaxLen: 20 });
    expect(hint.nodeTitle.length).toBeLessThanOrEqual(20);
  });
});
