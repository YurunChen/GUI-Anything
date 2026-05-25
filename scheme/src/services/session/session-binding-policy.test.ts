import { describe, expect, it } from 'bun:test';
import {
  deriveSessionBindingState,
  resolveSessionBindingIntent,
} from './session-binding-policy';

describe('session binding policy', () => {
  it('defaults to auto_latest for direct startup', () => {
    const intent = resolveSessionBindingIntent({});
    expect(intent.mode).toBe('auto_latest');
  });

  it('maps explicit -r ID intent to resume_specific', () => {
    const intent = resolveSessionBindingIntent({
      resumeModeRaw: 'specific',
      explicitSessionId: 'session-123',
    });
    expect(intent).toEqual({
      mode: 'resume_specific',
      explicitSessionId: 'session-123',
    });
  });

  it('maps -r picker intent to resume_picker and hides until flowchart-ready', () => {
    const intent = resolveSessionBindingIntent({
      resumeModeRaw: 'picker',
    });
    const hidden = deriveSessionBindingState(intent, {
      explorationCount: 0,
      summaryCount: 0,
      flowchartHintCount: 0,
    });
    expect(hidden.mode).toBe('resume_picker');
    expect(hidden.visibility).toBe('hide');
    expect(hidden.dataReady).toBe('none');
    expect(hidden.summaryPolicy.allowRegen).toBe(false);
  });

  it('shows resume views only when flowchart data is available', () => {
    const intent = resolveSessionBindingIntent({
      resumeModeRaw: 'specific',
      explicitSessionId: 'session-456',
    });
    const explorationOnly = deriveSessionBindingState(intent, {
      explorationCount: 1,
      summaryCount: 0,
      flowchartHintCount: 0,
    });
    expect(explorationOnly.visibility).toBe('show');
    expect(explorationOnly.dataReady).toBe('exploration_ready');
    expect(explorationOnly.summaryPolicy.allowRegen).toBe(false);

    const ready = deriveSessionBindingState(intent, {
      explorationCount: 1,
      summaryCount: 1,
      flowchartHintCount: 0,
    });
    expect(ready.visibility).toBe('show');
    expect(ready.dataReady).toBe('flowchart_ready');
    expect(ready.summaryPolicy.allowRegen).toBe(false);
  });

  it('shows resume view when graph cache is hit even before flowchart-ready', () => {
    const intent = resolveSessionBindingIntent({
      resumeModeRaw: 'specific',
      explicitSessionId: 'session-789',
    });
    const state = deriveSessionBindingState(intent, {
      explorationCount: 1,
      summaryCount: 0,
      flowchartHintCount: 0,
      graphCacheHit: true,
    });
    expect(state.visibility).toBe('show');
    expect(state.dataReady).toBe('exploration_ready');
    expect(state.summaryPolicy.allowRegen).toBe(false);
  });

  it('keeps auto_latest visible even when no data is ready', () => {
    const intent = resolveSessionBindingIntent({
      resumeModeRaw: 'auto_latest',
    });
    const state = deriveSessionBindingState(intent, {
      explorationCount: 0,
      summaryCount: 0,
      flowchartHintCount: 0,
    });
    expect(state.visibility).toBe('show');
    expect(state.dataReady).toBe('none');
    expect(state.summaryPolicy.allowRegen).toBe(true);
  });

  it('keeps bind_specific visible while still binding explicit session id', () => {
    const intent = resolveSessionBindingIntent({
      resumeModeRaw: 'bind_specific',
      explicitSessionId: 'session-new',
    });
    const state = deriveSessionBindingState(intent, {
      explorationCount: 0,
      summaryCount: 0,
      flowchartHintCount: 0,
    });
    expect(intent.mode).toBe('bind_specific');
    expect(intent.explicitSessionId).toBe('session-new');
    expect(state.visibility).toBe('show');
    expect(state.dataReady).toBe('none');
    expect(state.summaryPolicy.allowRegen).toBe(true);
  });

  it('treats explicit session id without resume mode as bind_specific', () => {
    const intent = resolveSessionBindingIntent({
      explicitSessionId: 'legacy-id-only',
    });
    expect(intent).toEqual({
      mode: 'bind_specific',
      explicitSessionId: 'legacy-id-only',
    });
  });
});
