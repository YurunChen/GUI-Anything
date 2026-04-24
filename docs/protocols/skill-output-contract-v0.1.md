# Skill Output Contract v0.1

## Envelope

Every message MUST be a single JSON object with:

- `v`: protocol version string, fixed to `0.1`
- `seq`: strictly increasing integer per session
- `ts`: ISO-8601 timestamp
- `source`: `{ agent, sessionId, model? }`
- `event`: canonical event payload

## Event Identity

Each `event` MUST contain:

- `type`: canonical event type
- `id`: globally unique event ID
- `traceId`: trace/correlation ID
- `parentId`: optional parent event ID

## Fallback Rule

When parser cannot classify a chunk/line, emit:

- `event.type = "raw_line"`
- `event.payload.text = <raw input>`
- `event.payload.reason = "parse_failed" | "unknown_format"`

Dropping unparsed output is not allowed.

## Compatibility

- v0.1.x changes are additive only.
- Unknown fields must be ignored by consumers.
- Unknown event types must not crash consumers.
