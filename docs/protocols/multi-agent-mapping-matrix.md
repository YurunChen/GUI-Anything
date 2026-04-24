# Multi-Agent Mapping Matrix (v0.2 backlog)

| Agent | Structured Output | Mapping Status | Fallback Strategy | Notes |
|---|---|---|---|---|
| Claude Code | stream-json/jsonl | v0.1 complete | text fallback + raw_line | Reference adapter done |
| Codex CLI | json/text (varies) | planned | line buffer + raw_line | Needs field mapping validation |
| OpenCode | mixed structured | planned | event classifier fallback | Validate tool event IDs |
| Gemini CLI | mixed structured | planned | line buffer + raw_line | Confirm stable block format |
| Generic CLI | text only | planned | raw_line only | Minimal compatibility mode |

## Required Deliverables per New Agent

1. Mapping spec doc (`docs/protocols/adapter-mapping-<agent>-v0.2.md`)
2. Input fixtures (valid + malformed)
3. Expected event fixtures
4. Conformance checklist run results
