# Project skills

| Skill | Source | Claude Code | Codex | Cursor |
|-------|--------|-------------|-------|--------|
| **llm-wiki** | [`llm-wiki/`](llm-wiki/) | `.claude/skills/llm-wiki/` → symlink | `.agents/skills/llm-wiki/` → symlink | `.cursor/rules/llm-wiki.mdc` |

Fresh clones include project-local entries for Claude Code, Codex, and Cursor.
Setup refreshes project-local links only:

```bash
./scripts/setup.sh
```

**One skill, two phases** (`/llm-wiki`):

| Phase | Trigger | Code |
|-------|---------|------|
| **1 — Ingest** | Flow pivot / session sweep | `wiki-agent/run.ts` |
| **2 — Maintain** | `./scripts/wiki/wiki-maintain.sh` | `wiki-maintain-agent/run.ts` |
