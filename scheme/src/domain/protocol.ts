/**
 * CLI Event Protocol Types
 * Defines the event envelope structure for Claude CLI event streaming.
 * @version 0.1
 */

export type CliEventType =
  | "session_start"
  | "session_end"
  | "turn_start"
  | "turn_end"
  | "user_message"
  | "text_delta"
  | "text_final"
  | "status"
  | "tool_use"
  | "tool_result"
  | "completion"
  | "error"
  | "artifact"
  | "raw_line";

export interface CliEventSource {
  agent: string;
  sessionId: string;
  model?: string;
}

export interface CliEventPayload {
  [key: string]: unknown;
}

export interface CliEvent {
  type: CliEventType;
  id: string;
  traceId: string;
  parentId?: string;
  payload: CliEventPayload;
}

export interface CliEventEnvelope {
  v: "0.1";
  seq: number;
  ts: string;
  source: CliEventSource;
  event: CliEvent;
}

export interface ParseContext {
  seq: number;
  source: CliEventSource;
  traceId: string;
}
