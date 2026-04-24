/**
 * ABOUTME: FlowRecorder — converts CliEventEnvelope stream into persistent SQLite records.
 * Mirrors ActivityTreeBuilder logic but focuses on per-node summarization and raw event storage.
 */

import type { CliEventEnvelope } from '@protocol/cli-event/v0.1/types';
import type { FlowStore } from '../core/flow-store';
import { FlowStore as FlowStoreType } from '../core/flow-store';
import { truncate } from '../utils/string';

const MAX_PREVIEW = 80;

function inputPreview(input: Record<string, unknown>): string {
  if (!input || Object.keys(input).length === 0) return '';
  const first = Object.values(input)[0];
  if (typeof first === 'string') return truncate(first, 60);
  return truncate(JSON.stringify(first), 60);
}

function resultPreview(content: unknown): string {
  if (typeof content === 'string') return truncate(content, 60);
  if (content === null || content === undefined) return '';
  return truncate(JSON.stringify(content), 60);
}

export class FlowRecorder {
  private store: FlowStoreType;
  private sessionId: string;
  private toolCallIdToNodeId = new Map<string, string>();
  private responseNodeId: string | null = null;
  private responseEvents: { raw: string; seq: number }[] = [];
  private responseNodeCreated = false;
  private startedAt: number;

  constructor(store: FlowStoreType, sessionId: string, prompt: string, model?: string) {
    this.store = store;
    this.sessionId = sessionId;
    this.startedAt = Date.now();
    store.createSession(sessionId, prompt, model ?? 'unknown');
  }

  addEvent(envelope: CliEventEnvelope, rawLine: string): void {
    const type = envelope.event.type;
    const payload = envelope.event.payload;
    const seq = envelope.seq;

    switch (type) {
      case 'tool_use': {
        this.flushResponse();
        const toolCallId = payload.toolCallId as string | undefined;
        const toolName = (payload.name as string) || 'unknown';
        const input = (payload.input as Record<string, unknown>) || {};
        const nodeId = `flow_${envelope.seq}`;
        const preview = inputPreview(input);
        const summary = preview ? `${toolName}(${preview})` : toolName;

        this.store.insertNode(nodeId, this.sessionId, 'tool_call', summary, null, toolName, preview);
        this.store.insertEvent(nodeId, type, rawLine, seq);

        if (toolCallId) {
          this.toolCallIdToNodeId.set(toolCallId, nodeId);
        }
        break;
      }

      case 'tool_result': {
        const toolCallId = payload.toolCallId as string | undefined;
        const parentFlowNodeId = toolCallId ? this.toolCallIdToNodeId.get(toolCallId) : undefined;
        const isError = payload.isError === true;
        const content = payload.content;
        const preview = resultPreview(content);
        const nodeId = `flow_${envelope.seq}`;
        const summary = isError ? `error: ${preview}` : (preview ? `ok (${preview})` : 'ok');

        this.store.insertNode(nodeId, this.sessionId, 'tool_result', summary, null, undefined, undefined, preview, parentFlowNodeId);
        this.store.insertEvent(nodeId, type, rawLine, seq);
        break;
      }

      case 'text_delta': {
        if (!this.responseNodeCreated) {
          this.responseNodeId = `flow_resp_${this.startedAt}`;
          this.responseNodeCreated = true;
          this.store.insertNode(
            this.responseNodeId,
            this.sessionId,
            'response',
            'Response (streaming)',
            null
          );
        }
        this.responseEvents.push({ raw: rawLine, seq });
        break;
      }

      case 'text_final': {
        this.flushResponse();
        if (this.responseNodeCreated && this.responseNodeId) {
          // Update summary with first sentence of response
          const text = payload.text as string | undefined;
          if (text) {
            const firstSentence = text.split(/[.!?]\s/)[0].slice(0, MAX_PREVIEW);
            this.store.insertNode(
              this.responseNodeId,
              this.sessionId,
              'response',
              firstSentence || text.slice(0, MAX_PREVIEW),
              null
            );
          }
        }
        break;
      }

      case 'status': {
        const status = payload.status as string | undefined;
        if (status) {
          const nodeId = `flow_${envelope.seq}`;
          const summary = status.includes('stream_init') ? 'initialized' : status.slice(0, MAX_PREVIEW);
          this.store.insertNode(nodeId, this.sessionId, 'thinking', summary, null);
          this.store.insertEvent(nodeId, type, rawLine, seq);
        }
        break;
      }

      case 'error': {
        const msg = payload.message as string | undefined;
        if (msg) {
          const nodeId = `flow_${envelope.seq}`;
          this.store.insertNode(nodeId, this.sessionId, 'thinking', `error: ${msg}`, null);
          this.store.insertEvent(nodeId, type, rawLine, seq);
        }
        break;
      }
    }
  }

  finalize(): void {
    this.flushResponse();
    this.store.updateSessionStatus(this.sessionId, 'complete', Date.now());
  }

  private flushResponse(): void {
    if (this.responseNodeId && this.responseNodeCreated && this.responseEvents.length > 0) {
      // Append all raw events to the response node
      for (const evt of this.responseEvents) {
        this.store.insertEvent(this.responseNodeId, 'text_delta', evt.raw, evt.seq);
      }
    }
    this.responseNodeId = null;
    this.responseEvents = [];
  }

  getStore(): FlowStoreType {
    return this.store;
  }

  getSessionId(): string {
    return this.sessionId;
  }
}
