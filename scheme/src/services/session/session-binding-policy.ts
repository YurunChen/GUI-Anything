/**
 * Session binding — launcher intent only (FLOW_RESUME_MODE → discovery mode).
 * Runtime phase / visibility / summary policy: session-runtime-policy.ts
 */

import { createLogger } from '../../utils/logger';

const log = createLogger('binding');

export type SessionBindingMode =
  | 'auto_latest'
  | 'bind_specific'
  | 'continue'
  | 'continue_picker';

export interface SessionBindingIntent {
  mode: SessionBindingMode;
  explicitSessionId?: string;
}

export function resolveSessionBindingIntent(input: {
  resumeModeRaw?: string;
  explicitSessionId?: string;
}): SessionBindingIntent {
  const explicitSessionId = input.explicitSessionId?.trim() || undefined;
  const resumeMode = normalizeResumeMode(input.resumeModeRaw);

  let intent: SessionBindingIntent;
  if (resumeMode === 'continue') {
    intent = { mode: 'continue', explicitSessionId };
  } else if (resumeMode === 'continue_picker') {
    intent = { mode: 'continue_picker' };
  } else if (resumeMode === 'bind_specific') {
    intent = { mode: 'bind_specific', explicitSessionId };
  } else if (resumeMode === 'auto_latest') {
    intent = { mode: 'auto_latest' };
  } else if (explicitSessionId) {
    intent = { mode: 'bind_specific', explicitSessionId };
  } else {
    intent = { mode: 'auto_latest' };
  }

  log.debug('binding intent resolved', {
    resumeModeRaw: input.resumeModeRaw,
    mode: intent.mode,
    explicitSessionId: intent.explicitSessionId,
  });
  return intent;
}

export function isContinueMode(mode: SessionBindingMode): boolean {
  return mode === 'continue' || mode === 'continue_picker';
}

export function isNewSessionMode(mode: SessionBindingMode): boolean {
  return mode === 'bind_specific' || mode === 'auto_latest';
}

function normalizeResumeMode(
  rawMode: string | undefined,
): 'continue' | 'continue_picker' | 'bind_specific' | 'auto_latest' | 'unset' {
  const normalized = (rawMode || '').trim().toLowerCase();
  if (
    normalized === 'continue'
    || normalized === 'replay'
    || normalized === 'specific'
    || normalized === 'resume_specific'
  ) {
    return 'continue';
  }
  if (
    normalized === 'continue_picker'
    || normalized === 'replay_picker'
    || normalized === 'picker'
    || normalized === 'resume_picker'
  ) {
    return 'continue_picker';
  }
  if (normalized === 'bind_specific') return 'bind_specific';
  if (normalized === 'auto_latest') return 'auto_latest';
  return 'unset';
}
