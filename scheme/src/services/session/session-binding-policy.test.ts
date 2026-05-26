import { describe, expect, it } from 'bun:test';
import { resolveSessionBindingIntent } from './session-binding-policy';

describe('session binding policy', () => {
  it('defaults to auto_latest for direct startup', () => {
    const intent = resolveSessionBindingIntent({});
    expect(intent.mode).toBe('auto_latest');
  });

  it('maps -c / -r ID to continue', () => {
    const intent = resolveSessionBindingIntent({
      resumeModeRaw: 'continue',
      explicitSessionId: 'session-123',
    });
    expect(intent).toEqual({
      mode: 'continue',
      explicitSessionId: 'session-123',
    });

    const legacy = resolveSessionBindingIntent({
      resumeModeRaw: 'replay',
      explicitSessionId: 'session-123',
    });
    expect(legacy.mode).toBe('continue');
  });

  it('maps -r picker to continue_picker', () => {
    const intent = resolveSessionBindingIntent({ resumeModeRaw: 'continue_picker' });
    expect(intent.mode).toBe('continue_picker');
  });
});
