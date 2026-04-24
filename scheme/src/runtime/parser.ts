import type { CliEventEnvelope, CliEventType, ParseContext } from '@protocol/cli-event/v0.1/types';

function nowIso(): string {
  return new Date().toISOString();
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
  } else if (msgType === "user") {
    const message = parsed.message as { content?: Array<Record<string, unknown>> } | undefined;
    if (message?.content) {
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
      makeEnvelope(ctx, isError ? "error" : "text_final", {
        text: resultText,
        durationMs: duration
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
