# CLI Event Conformance Checklist (v0.2 backlog)

Use this checklist when expanding beyond v0.1.

## Envelope and Ordering

- [ ] `v`, `seq`, `ts`, `source`, `event` always present.
- [ ] `seq` is monotonic per session.
- [ ] Duplicate events are idempotently handled by reducers.

## Event Semantics

- [ ] Every `tool_result` references a `toolCallId`.
- [ ] `status` transitions are valid (no impossible jumps).
- [ ] `artifact` events include stable identity fields.

## Fallback and Safety

- [ ] Unknown formats emit `raw_line`.
- [ ] Parse failures never crash the stream loop.
- [ ] Unknown event types are ignored safely by renderer.

## Surface Projection

- [ ] Event-to-surface rules are complete for enabled event types.
- [ ] Projection logic is deterministic under replay.
- [ ] Renderer reads only surface state.

## Replay and Regression

- [ ] Fixture replay reproduces expected surface state snapshot.
- [ ] New adapters include malformed input fixtures.
- [ ] Cross-version fixtures (v0.1 -> v0.2) pass compatibility checks.
