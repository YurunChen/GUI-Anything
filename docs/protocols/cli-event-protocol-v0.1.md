# CLI Event Protocol v0.1

This protocol standardizes CLI agent output into a canonical event stream for UI rendering.

## Envelope

Each message is one JSON object with:

- `v`: fixed value `0.1`
- `seq`: monotonic session-local sequence number
- `ts`: ISO timestamp
- `source`: `{ agent, sessionId, model? }`
- `event`: event object

## Event Types

- `session_start`, `session_end`
- `turn_start`, `turn_end`
- `text_delta`, `text_final`
- `status`
- `tool_use`, `tool_result`
- `error`
- `artifact`
- `raw_line`

## Required Event Fields

Each event must include:

- `type`
- `id`
- `traceId`
- `payload`

Optional:

- `parentId`

## Tool Correlation

- `tool_use.payload.toolCallId` is required.
- `tool_result.payload.toolCallId` is required.
- If upstream does not provide IDs, adapter must synthesize a stable ID and mark it in payload metadata.

## Fallback

If adapter cannot parse an output line/chunk, it must emit:

- `event.type = "raw_line"`
- `event.payload.text = <raw content>`
- `event.payload.reason = "parse_failed" | "unknown_format" | "text_fallback"`

No silent drop is allowed.
