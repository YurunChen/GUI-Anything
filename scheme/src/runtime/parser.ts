import type { CliEventEnvelope, CliEventType, ParseContext } from '@protocol/cli-event/v0.1/types';

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

export function parseClaudeJsonLine(
  line: string,
  ctx: ParseContext
): CliEventEnvelope[] {
  const trimmed = line.trim();
  if (!trimmed) return [];

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    return [
      makeEnvelope(ctx, "raw_line", {
        text: line,
        reason: "parse_failed"
      })
    ];
  }

  const events: CliEventEnvelope[] = [];
  const msgType = parsed.type;
  if (msgType === "assistant") {
    const message = parsed.message as {
      content?: Array<Record<string, unknown>>;
      model?: string;
      stop_reason?: string;
    } | undefined;
    if (typeof message?.model === "string" && message.model.length > 0) {
      ctx.source = {
        ...ctx.source,
        model: message.model
      };
    }
    if (message?.content) {
      for (const block of message.content) {
        if (block.type === "text" && typeof block.text === "string") {
          events.push(makeEnvelope(ctx, "text_delta", { text: block.text }));
        } else if (
          (block.type === "thinking" || block.type === "redacted_thinking") &&
          typeof block.text === "string"
        ) {
          events.push(
            makeEnvelope(ctx, "status", {
              status: "thinking",
              details: block.text
            })
          );
        } else if (block.type === "tool_use") {
          events.push(
            makeEnvelope(ctx, "tool_use", {
              toolCallId: block.id,
              name: block.name,
              input: block.input ?? {}
            })
          );
        }
      }
    }
    // Detect exploration completion via end_turn.
    // Some logs store stop_reason on the top-level entry.
    const stopReason =
      (typeof message?.stop_reason === "string" ? message.stop_reason : undefined) ??
      (typeof parsed.stop_reason === "string" ? parsed.stop_reason : undefined);
    if (stopReason === "end_turn") {
      events.push(
        makeEnvelope(ctx, "completion", {
          reason: "end_turn",
          timestamp: parseTimestamp(parsed.timestamp)
        })
      );
    }
  } else if (msgType === "user") {
    const isMeta = parsed.isMeta === true;
    const message = parsed.message as {
      content?: string | Array<Record<string, unknown>>;
    } | undefined;

    // Extract user text content for exploration start.
    // Claude logs may encode user content as a plain string or block array.
    if (!isMeta && typeof message?.content === "string" && message.content.trim()) {
      events.push(
        makeEnvelope(ctx, "user_message", {
          text: message.content,
          timestamp: parseTimestamp(parsed.timestamp)
        })
      );
    } else if (!isMeta && Array.isArray(message?.content)) {
      for (const block of message.content) {
        if (block.type === "text" && typeof block.text === "string") {
          events.push(
            makeEnvelope(ctx, "user_message", {
              text: block.text,
              timestamp: parseTimestamp(parsed.timestamp)
            })
          );
        } else if (block.type === "tool_result") {
          events.push(
            makeEnvelope(ctx, "tool_result", {
              toolCallId: block.tool_use_id,
              content: block.content,
              isError: block.is_error === true
            })
          );
        }
      }
    } else if (Array.isArray(message?.content)) {
      // For meta or non-text user messages, just process tool_results
      for (const block of message.content) {
        if (block.type === "tool_result") {
          events.push(
            makeEnvelope(ctx, "tool_result", {
              toolCallId: block.tool_use_id,
              content: block.content,
              isError: block.is_error === true
            })
          );
        }
      }
    }
  } else if (msgType === "error") {
    events.push(
      makeEnvelope(ctx, "error", {
        message: parsed.error ?? "unknown error"
      })
    );
  } else if (msgType === "system") {
    const subtype = typeof parsed.subtype === "string" ? parsed.subtype : "system";
    if (subtype === "init") {
      const model = typeof parsed.model === "string" ? parsed.model : "unknown-model";
      const sessionId =
        typeof parsed.session_id === "string" ? parsed.session_id : "unknown-session";
      ctx.source = {
        ...ctx.source,
        model,
        sessionId
      };
      events.push(
        makeEnvelope(ctx, "status", {
          status: `stream_init model=${model} session=${sessionId}`
        })
      );
    } else {
      events.push(
        makeEnvelope(ctx, "status", {
          status: `system:${subtype}`
        })
      );
    }
  } else if (msgType === "result") {
    const duration = typeof parsed.duration_ms === "number" ? parsed.duration_ms : undefined;
    const isError = parsed.is_error === true;
    const resultText =
      typeof parsed.result === "string"
        ? parsed.result
        : isError
          ? "result error"
          : "result complete";
    events.push(
      makeEnvelope(ctx, "completion", {
        reason: isError ? "error" : "result",
        isError,
        text: resultText,
        durationMs: duration,
        timestamp: parseTimestamp(parsed.timestamp)
      })
    );
  }

  if (events.length === 0) {
    events.push(
      makeEnvelope(ctx, "raw_line", {
        text: trimmed,
        reason: "unknown_format"
      })
    );
  }
  return events;
}

export function parseTextLine(line: string, ctx: ParseContext): CliEventEnvelope {
  return makeEnvelope(ctx, "raw_line", {
    text: line,
    reason: "text_fallback"
  });
}
