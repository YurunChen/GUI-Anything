# GUI-Anything

**Claude Code on the left. Your project's living memory on the right.**

A dual-pane terminal observer for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) — watch explorations unfold, compound wiki knowledge across sessions, and stay in flow without alt-tabbing into log files.

```text
┌─ Claude Code ────────────────┐┌─ Flow Observer ──────────────┐
│  You: refactor auth layer    ││  ● Implement · pivot         │
│  ▸ Read src/auth/*.ts        ││  ├─ exploration timeline     │
│  ▸ Edit middleware.ts        ││  ├─ flowchart (rail/stack)   │
│  …                           ││  ├─ KNOWLEDGE: C012 hit      │
│                              ││  └─ wiki C001 saved ✓        │
└──────────────────────────────┘└──────────────────────────────┘
         ga flow — one command, both panes
```

---

## Why this exists

Claude Code is excellent at **doing** — less excellent at showing you *where you are* in a long session.

After an hour you might wonder:

- Which explorations already happened?
- What did we learn that’s worth keeping?
- Can I resume yesterday’s session **without** re-summarizing everything?

**GUI-Anything** is a **sidecar observer**: it reads Claude’s JSONL, renders a live timeline + flowchart, and writes durable notes into a local `wiki/` — without hijacking the left pane.

Built around three ideas:

| | Principle | In practice |
|---|-----------|-------------|
| 🧘 | **心流 Flow** | One timeline; help & notes only on hotkeys |
| 🧠 | **按需知识 On-demand** | Wiki search when useful; curate on intent pivot — not every turn |
| ✨ | **无感 Seamless** | `ga flow` binds project + session; failures don’t block Claude |

---

## Quick start

**Requirements:** [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) · [Bun](https://bun.sh) · [Zellij](https://zellij.dev)

```bash
git clone https://github.com/YurunChen/GUI-Anything.git
cd GUI-Anything
./scripts/setup.sh

ga doctor    # sanity check
ga flow      # dual pane: Claude | Observer
```

Or without cloning:

```bash
npx gui-anything@latest doctor
npm i -g gui-anything && ga flow
```

**Common commands**

```bash
ga flow                              # new session
ga flow --continue                   # pick up latest work
ga flow --resume <session-id>        # strict replay (no AI re-summary)
ga flow --model sonnet "your task"   # pass a model + prompt
./scripts/flow-run.sh --cleanup      # kill stale zellij / orphan processes
```

---

## What makes it fun

| | Feature | Why you’ll care |
|---|---------|-----------------|
| 🪟 | **Dual-pane Flow** | Claude stays native; observer watches in real time |
| 🗺️ | **Live flowchart** | Tree with connectors — rail / stack / grid by terminal width |
| 📇 | **Inline wiki hits** | Prior knowledge surfaces on each exploration card |
| 🪣 | **Intent-aware wiki** | Same task compounds in a bucket; pivot closes it → `/llm-wiki` agent writes `contexts/` |
| 🎨 | **32 themes** | Hot-swap in observer — `[` `]` · Apple System default · morandi cycle · light/dark |
| 📱 | **Web Mirror** | Watch progress in the browser (phone-friendly WebSocket) |
| 🎬 | **Session Replay HTML** | Export one self-contained HTML file to share or review offline |
| 🔔 | **Push notifications** | WeChat / Feishu / DingTalk when errors or milestones hit |
| ⏪ | **Honest resume** | `-r` replays cache — won’t silently re-run summary AI |
| ↩️ | **Continue** | `-c` reloads `wiki/sessions/{id}/bundle.json`; only new explorations trigger summary AI |

---

## Observer at a glance

**Run → Capture → Guide**

```text
Run      JSONL → explorations, tools, errors, phases
Capture  AI summaries, flowchart hints, intent buckets, wiki
Guide    prior wiki matches, flowchart, hotkeys
```

Focus the **right pane** first, then:

| Key | Action |
|-----|--------|
| `g` | Timeline ↔ flowchart |
| `i` | Notes sidebar |
| `?` / `/` / `Ctrl-K` | Keyboard help |
| `c` | Calm mode (collapse older cards) |
| `[` `]` | Prev / next theme |
| `k` | Flag wrong wiki match → audit |
| `q` | Quit observer |

Full list: help overlay inside `ga flow`. Chinese chrome: `FLOW_LOCALE=zh-Hans`.

---

## Optional superpowers

<details>
<summary><b>HTML export</b> — replay, mirror, knowledge graph</summary>

```bash
cd scheme

# Single-file interactive replay
bun run src/main.ts --export-html -o replay.html

# Real-time browser view (align session with FLOW_SESSION_ID)
FLOW_PROJECT_DIR=/path/to/repo FLOW_SESSION_ID=<uuid> \
  bun run src/main.ts --web-mirror --port 3001

# Force-directed graph from local wiki
bun run src/main.ts --knowledge-graph -o graph.html
```

See [docs/IDEAS_HTML_INTEGRATION.md](docs/IDEAS_HTML_INTEGRATION.md) · [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)

</details>

<details>
<summary><b>Notifications</b> — WeChat / Feishu / DingTalk</summary>

1. `./scripts/start-weixin-service.sh` (WeChat)  
2. `./scripts/weixin-login.sh`  
3. Set `FLOW_NOTIFY_WECHAT_USER_ID` and run `ga flow`

[Notification guide](docs/NOTIFICATION.md) · [WeChat setup](docs/NOTIFICATION_WECHAT.md)

</details>

<details>
<summary><b>llm-wiki</b> — agentic knowledge ingest</summary>

Wiki curation uses the `/llm-wiki` skill (`skills/llm-wiki/`). Setup symlinks it for Claude:

```bash
./scripts/setup.sh   # → .claude/skills/llm-wiki/
./scripts/wiki/wiki-maintain.sh   # Phase 2 maintenance
```

[scripts/wiki/README.md](scripts/wiki/README.md)

</details>

---

## Project layout

| Path | What |
|------|------|
| `cli/` | Public **`ga`** command |
| `scheme/` | Observer app (OpenTUI + Bun) |
| `scripts/flow-run.sh` | Zellij dual-pane launcher |
| `skills/` | Wiki agent skills |
| `docs/` | Design docs & runbooks |
| `wiki/` | Local knowledge (gitignored) |

---

## Docs & development

| Doc | For |
|-----|-----|
| **[docs/development.md](docs/development.md)** | Architecture, collaboration, extension guide |
| [AGENTS.md](AGENTS.md) | Coding-agent principles & red lines |
| [docs/data-governance/data-flow.md](docs/data-governance/data-flow.md) | Wiki & session data flow |
| [docs/THEMES.md](docs/THEMES.md) | Theme catalog |
| [docs/release-checklist.md](docs/release-checklist.md) | Release process |

**Contributors**

```bash
cd scheme && bun test && bunx tsc --noEmit
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `zellij: command not found` | `brew install zellij` then `ga doctor` |
| Stale sessions / orphan processes | `./scripts/flow-run.sh --cleanup` |
| Module errors in scheme | `cd scheme && rm -rf node_modules && bun install` |
| Observer shortcuts don’t work | Click the **right pane** first |

More: [docs/development.md §5](docs/development.md) · `ga doctor` output

---

## License

See repository license file. Claude Code and third-party tools are subject to their own terms.

**Star ⭐ if a sidecar observer beats parsing JSONL by hand.**
