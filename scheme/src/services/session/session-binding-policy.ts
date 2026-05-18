export type SessionBindingMode = 'auto_latest' | 'resume_specific' | 'resume_picker' | 'bind_specific';
export type SessionDataReadyState = 'none' | 'exploration_ready' | 'flowchart_ready';
export type SessionVisibilityState = 'show' | 'hide';

export interface SessionBindingIntent {
  mode: SessionBindingMode;
  explicitSessionId?: string;
}

export interface SessionBindingState {
  mode: SessionBindingMode;
  explicitSessionId?: string;
  dataReady: SessionDataReadyState;
  visibility: SessionVisibilityState;
  summaryPolicy: {
    allowRegen: boolean;
  };
}

export interface SessionSummaryPolicy {
  allowRegen: boolean;
}

export interface SessionBindingDataInput {
  explorationCount: number;
  summaryCount: number;
  flowchartHintCount: number;
  graphCacheHit?: boolean;
}

export function resolveSessionBindingIntent(input: {
  resumeModeRaw?: string;
  explicitSessionId?: string;
}): SessionBindingIntent {
  const explicitSessionId = input.explicitSessionId?.trim() || undefined;
  const resumeMode = normalizeResumeMode(input.resumeModeRaw);

  if (resumeMode === 'specific') {
    return {
      mode: 'resume_specific',
      explicitSessionId,
    };
  }
  if (resumeMode === 'picker') {
    return {
      mode: 'resume_picker',
    };
  }
  if (resumeMode === 'bind_specific') {
    return {
      mode: 'bind_specific',
      explicitSessionId,
    };
  }
  if (resumeMode === 'auto_latest') {
    return {
      mode: 'auto_latest',
    };
  }

  // Backward compatible: explicit session id without resume mode means explicit binding.
  if (explicitSessionId) {
    return {
      mode: 'bind_specific',
      explicitSessionId,
    };
  }

  return {
    mode: 'auto_latest',
  };
}

export function deriveSessionBindingState(
  intent: SessionBindingIntent,
  data: SessionBindingDataInput,
): SessionBindingState {
  const dataReady = deriveDataReadyState(data);
  const resumeMode = intent.mode === 'resume_picker' || intent.mode === 'resume_specific';
  const summaryPolicy = deriveSessionSummaryPolicy(intent);
  const canShowInResume = data.graphCacheHit || dataReady === 'flowchart_ready';
  const shouldHideInResume = resumeMode && !canShowInResume;
  return {
    mode: intent.mode,
    explicitSessionId: intent.explicitSessionId,
    dataReady,
    visibility: shouldHideInResume ? 'hide' : 'show',
    summaryPolicy,
  };
}

export function deriveSessionSummaryPolicy(intent: SessionBindingIntent): SessionSummaryPolicy {
  const resumeMode = intent.mode === 'resume_picker' || intent.mode === 'resume_specific';
  return {
    allowRegen: !resumeMode,
  };
}

function deriveDataReadyState(data: SessionBindingDataInput): SessionDataReadyState {
  if (data.explorationCount <= 0) {
    return 'none';
  }
  if (data.summaryCount <= 0 && data.flowchartHintCount <= 0) {
    return 'exploration_ready';
  }
  return 'flowchart_ready';
}

function normalizeResumeMode(rawMode: string | undefined): 'specific' | 'picker' | 'bind_specific' | 'auto_latest' | 'unset' {
  const normalized = (rawMode || '').trim().toLowerCase();
  if (normalized === 'specific' || normalized === 'resume_specific') return 'specific';
  if (normalized === 'picker' || normalized === 'resume_picker') return 'picker';
  if (normalized === 'bind_specific') return 'bind_specific';
  if (normalized === 'auto_latest') return 'auto_latest';
  return 'unset';
}
