# UI Surface Model v0.1

## Scope

v0.1 defines two surfaces only:

- `conversationSurface`
- `toolTimelineSurface`

## Routing Rules

- `tool_use`, `tool_result` route to `toolTimelineSurface`.
- All other v0.1 events route to `conversationSurface`.

Routing is config-driven in:

- `protocol/ui-surface/v0.1/event-to-surface-map.json`

## Surface State

### conversationSurface

- Append-only rows for transcript/status/error/raw fallback.
- Row shape: `{ eventId, type, text?, status?, ts }`.

### toolTimelineSurface

- Keyed by `toolCallId`.
- Tool use starts an item; tool result updates the same item.

## Architectural Constraints

- Adapter layer emits canonical events only.
- Surface model builds deterministic state from canonical events.
- Renderer consumes only surface state and must not parse raw agent output.
