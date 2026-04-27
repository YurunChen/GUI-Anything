import type { CliEventEnvelope, CliEventType, ParseContext } from '../../domain/protocol';

function nowIso(): string {
  return new Date().toISOString();
}

function parseTimestamp(ts: unknown): number {
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'string') {
    const parsed = Date.parse(ts);
    return isNaN(parsed) ? Date.now() : parsed;
  }
  return Date.now();
}

function nextSeq(ctx: ParseContext): number {
  ctx.seq += 1;
  return ctx.seq;
}

function nextEventId(seq: number): string {
  return `evt_${seq}`;
}

function makeEnvelope(
  ctx: ParseContext,
  type: CliEventType,
  payload: Record<string, unknown>,
  parentId?: string
): CliEventEnvelope {
  const seq = nextSeq(ctx);
  return {
    v: "0.1",
    seq,
    ts: nowIso(),
    source: ctx.source,
    event: {
      type,
      id: nextEventId(seq),
      traceId: ctx.traceId,
      parentId,
      payload
    }
  };
}

function isEmptyObject(obj: unknown): boolean {
  return typeof obj === 'object' && obj !== null && Object.keys(obj).length === 0;
}

function normalizeContent(raw: unknown): { text?: string; error?: string } {
  if (raw === null || raw === undefined) return {};
  if (typeof raw === 'string') return { text: raw };
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    // Handle thinking / redacted_thinking
    if (typeof obj.thinking === 'string') return { text: obj.thinking };
    if (typeof obj.data === 'string') return { text: obj.data };
    // Handle result content
    if (typeof obj.content === 'string') return { text: obj.content };
    if (typeof obj.error === 'string') return { error: obj.error };
  }
  return {};
}

function tryParsePartial(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function extractModelFromRawEvent(obj: Record<string, unknown>): string | null {
  const topLevelModel = obj.model;
  if (typeof topLevelModel === 'string' && topLevelModel.trim().length > 0) {
    return topLevelModel.trim();
  }
  const message = obj.message;
  if (message && typeof message === 'object') {
    const nestedModel = (message as Record<string, unknown>).model;
    if (typeof nestedModel === 'string' && nestedModel.trim().length > 0) {
      return nestedModel.trim();
    }
  }
  return null;
}

export function parseClaudeJsonLine(
  line: string,
  ctx: ParseContext
): CliEventEnvelope | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Try standard JSON envelope first
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    // Try to parse as partial JSON line (streaming artifacts)
    parsed = tryParsePartial(trimmed);
    if (!parsed) return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;

  // Keep runtime model in sync with latest raw event.
  const eventModel = extractModelFromRawEvent(obj);
  if (eventModel) {
    ctx.source.model = eventModel;
  }

  // Already a proper envelope
  if (obj.v === '0.1' && typeof obj.seq === 'number' && obj.event && typeof (obj.event as Record<string, unknown>).type === 'string') {
    return obj as CliEventEnvelope;
  }

  // Map raw events to envelopes
  const type = obj.type as string | undefined;

  // tool_use / tool_call
  if (type === 'tool_use' || type === 'tool_call') {
    return makeEnvelope(ctx, 'tool_use', {
      toolCallId: obj.toolCallId || obj.id,
      name: obj.name,
      input: obj.input || obj.arguments
    });
  }

  // tool_result
  if (type === 'tool_result' || type === 'tool_response') {
    return makeEnvelope(ctx, 'tool_result', {
      toolCallId: obj.toolCallId || obj.tool_call_id,
      isError: obj.isError === true || obj.error !== undefined,
      content: obj.content || obj.result || obj.error,
    });
  }

  // text_delta / content_chunk
  if (type === 'text_delta' || type === 'content' || type === 'chunk') {
    const normalized = normalizeContent(obj.content ?? obj.text ?? obj.delta);
    return makeEnvelope(ctx, 'text_delta', { text: normalized.text || '' });
  }

  // text_final / assistant_message
  if (type === 'text_final' || type === 'assistant') {
    const normalized = normalizeContent(obj.content ?? obj.text);
    return makeEnvelope(ctx, 'text_final', { text: normalized.text || '', isError: !!normalized.error });
  }

  // status / heartbeat
  if (type === 'status' || type === 'heartbeat' || type === 'initialized') {
    return makeEnvelope(ctx, 'status', { status: obj.status || type });
  }

  // error
  if (type === 'error' || obj.error !== undefined) {
    return makeEnvelope(ctx, 'error', { message: String(obj.message || obj.error || 'Unknown error') });
  }

  // completion / done
  if (type === 'completion' || type === 'done' || type === 'finished') {
    return makeEnvelope(ctx, 'completion', { isError: obj.isError === true });
  }

  return null;
}

export function createParseContext(traceId?: string, source?: { model?: string; name?: string }): ParseContext {
  return {
    seq: 0,
    traceId: traceId || `trace_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    source: {
      model: source?.model || 'unknown-model',
      name: source?.name || 'claude-cli'
    }
  };
}
