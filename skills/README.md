# Project skills (Claude Code)

| Skill | Source | Claude discovery |
|-------|--------|------------------|
| **llm-wiki** | [`llm-wiki/`](llm-wiki/) | `.claude/skills/llm-wiki/` → symlink |

Fresh clones already have `.claude/skills/llm-wiki` in the repo (relative symlink). Optional global link:

```bash
./scripts/setup.sh   # also links ~/.claude/skills/llm-wiki → project .claude/skills/llm-wiki
```

**One skill, two phases** (`/llm-wiki`):

| Phase | Trigger | Code |
|-------|---------|------|
| **1 — Ingest** | Flow pivot / session sweep | `wiki-agent/run.ts` |
| **2 — Maintain** | `./scripts/wiki/wiki-maintain.sh` | `wiki-maintain-agent/run.ts` |

Deprecated alias folder `llm-wiki-maintain/` redirects to `llm-wiki/SKILL.md`.
