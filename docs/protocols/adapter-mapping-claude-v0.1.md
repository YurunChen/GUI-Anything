# Adapter Mapping: Claude v0.1

## Input Modes

- Preferred: Claude `stream-json`
- Fallback: plain text lines

## Mapping Table

| Claude Output | Canonical Event | Notes |
|---|---|---|
| `assistant.message.content[].type=text` | `text_delta` | emit in arrival order |
| `assistant.message.content[].type=tool_use` | `tool_use` | map `id -> toolCallId`, preserve `name/input` |
| `user.message.content[].type=tool_result` | `tool_result` | map `tool_use_id -> toolCallId`, preserve error flag |
| top-level `error` | `error` | preserve message/details |
| unknown JSON / unsupported block | `raw_line` | reason = `unknown_format` |

## Text Fallback State Machine

1. Append chunks into a line buffer.
2. Split complete lines by newline.
3. For each complete line:
   - try JSON parse and structured mapping;
   - on failure emit `raw_line` with `reason=text_fallback`.
4. Flush residual partial line on stream close as `raw_line`.

## Error Handling Rules

- Parser exceptions must not terminate the stream.
- Malformed lines are preserved as `raw_line`.
- Missing `tool_use_id` in tool results emits `tool_result` with synthetic ID and warning metadata.
