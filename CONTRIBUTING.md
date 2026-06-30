# Contributing to GUI-Anything

Thanks for considering a contribution. This guide covers local setup,
verification, and pull request expectations. Architecture details live in
[docs/development.md](docs/development.md), and coding-agent guardrails live in
[AGENTS.md](AGENTS.md).

<p align="right">
  <a href="README.md">English README</a> · <a href="README_CN.md">Simplified Chinese README</a>
</p>

---

## Requirements

| Dependency | Purpose | Install |
| --- | --- | --- |
| [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) | Left-pane agent for manual `ga flow` checks | Official docs |
| [Bun](https://bun.sh) | Runtime and test runner for `scheme/` | `curl -fsSL https://bun.sh/install \| bash` |
| [Zellij](https://zellij.dev) | Dual-pane launcher | `brew install zellij` on macOS |
| Node.js >= 20 | `ga` CLI and local `npm link` | Official LTS |
| Git | Version control | System package manager |

Optional: a logged-in Claude Code setup with local session JSONL files under
`~/.claude/projects/.../*.jsonl` for live manual testing.

---

## First Setup

```bash
git clone https://github.com/YurunChen/GUI-Anything.git
cd GUI-Anything

./scripts/setup.sh          # Bun deps, Zellij check, llm-wiki skill symlink
cd scheme && bun install    # can be skipped if setup already completed it

# Verify
cd scheme && bun test && bunx tsc --noEmit
cd .. && ga doctor          # requires npm link, PATH setup, or direct node usage
```

### Point `ga` at your checkout

Use either option during development:

```bash
# Option A: npm link, recommended for local development
npm link
ga doctor

# Option B: run the CLI directly
node ./cli/ga.mjs doctor
node ./cli/ga.mjs flow
```

### Run only the right-pane Observer

When you do not need the full Zellij layout, run the Observer directly:

```bash
cd scheme
FLOW_PROJECT_DIR=/path/to/your/repo \
FLOW_SESSION_ID=<claude-session-uuid> \
bun run start:live
```

`FLOW_SESSION_ID` comes from the matching JSONL filename under
`~/.claude/projects/`.

---

## Daily Development Loop

1. Pull the latest `main` and create a feature branch.
2. Read the request and identify the changed layer: `data`, `services`, hooks,
   or UI.
3. Edit `scheme/src/`, and only touch `scripts/`, `skills/`, or `cli/` when the
   request requires it.
4. Run the relevant verification commands.
5. Update `docs/`, `README.md`, `README_CN.md`, or `AGENTS.md` when user-visible
   behavior changes.
6. Open a pull request with a clear change summary and test plan.

### Where should a change live?

| Task | Start here |
| --- | --- |
| New persisted fields or file IO | `scheme/src/data/` |
| Summary, wiki, or session policy | `scheme/src/services/` |
| React orchestration and polling | `scheme/src/app/observer/hooks/` |
| Presentation, keys, and themes | `scheme/src/app/ui/` |
| Cross-layer data shapes | `scheme/src/data/protocol/` first |
| Launch flags and env injection | `scripts/flow-run.sh` |
| Public CLI behavior | `cli/ga.mjs` |

Do not put `fs` access in UI components. Do not duplicate session binding,
resume, or wiki persistence policy branches across modules. See
[AGENTS.md section 4](AGENTS.md) for the dependency rules.

---

## Verification Before a Pull Request

List the checks you ran in the PR description. Minimum expectations:

```bash
# 1. Scheme tests and type check, required for code changes
cd scheme && bun test && bunx tsc --noEmit

# 2. Root CLI checks, required when cli/ changes
cd .. && npm run verify

# 3. Environment check, recommended when flow behavior changes
ga doctor
```

### Manual checks for UI, session, and wiki changes

- [ ] `ga flow` starts the dual-pane layout, and right-pane shortcuts work after
      the right pane is focused.
- [ ] Resume behavior is correct for `ga flow -c` and `ga flow -r <id>` when the
      change touches session binding.
- [ ] KNOWLEDGE cards and wiki write badges remain separate concepts when the
      change touches wiki behavior.
- [ ] New `FLOW_*` variables are documented in `./scripts/flow-run.sh --help`
      and [docs/development.md section 5.2](docs/development.md).

### Definition of done

- [ ] Behavior changes have tests, or the PR explains why a test is not useful.
- [ ] `bun test` and `tsc --noEmit` pass.
- [ ] The architecture rules in [AGENTS.md](AGENTS.md) are still respected.
- [ ] Related `docs/` or README files are updated, or the PR explains why no
      docs update is needed.
- [ ] `wiki/`, `.flow-runtime/`, local logs, and secrets are not committed.

---

## Open a Pull Request

### 1. Branch

```bash
git checkout main
git pull origin main
git checkout -b feat/short-description
```

Use a focused branch name such as `feat/wiki-retrieval-cache`,
`fix/resume-banner-copy`, or `docs/flow-env-table`.

### 2. Commit

Follow the existing style: short, imperative, and specific about the change.

```text
feat: add calm mode toggle to exploration cards
fix: prevent duplicate summary regen on continue bind
docs: document FLOW_LOG_MODULES in development guide
test: cover session-runtime-policy replay branch
```

Keep one pull request to one coherent change. Avoid unrelated refactors and
large formatting-only diffs.

### 3. PR body template

```markdown
## Summary
<!-- 1-3 sentences: problem, approach, user-visible change -->

## Changes
<!-- Key files or modules; call out changes to single-source policy modules -->

## Test plan
- [ ] `cd scheme && bun test && bunx tsc --noEmit`
- [ ] `npm run verify` if `cli/` changed
- [ ] Manual check: <!-- ga flow / -c / -r / exact scenario -->

## Docs
- [ ] Updated docs / README / AGENTS.md
- [ ] No docs needed because <!-- reason -->

## Risks
<!-- Optional: regression risk or uncovered edge case -->
```

### 4. Review focus

| Area | What reviewers check |
| --- | --- |
| Dependency direction | UI does not import services or repositories directly |
| Single source of truth | Binding, resume, and wiki gates are not reimplemented elsewhere |
| Protocol first | Cross-layer behavior changes update `data/protocol/` first |
| Tests | Important branches are covered |
| Docs | User-visible changes are reflected in README or docs |

---

## Do Not Commit

| Path or content | Reason |
| --- | --- |
| `wiki/` | Local project memory |
| `.flow-runtime/` | Zellij layout cache |
| `logs/`, `*.log` | Local debug output |
| `.env`, tokens, webhook URLs | Secrets |
| Large unrelated formatting or file moves | Review noise |

If something was staged by mistake, run `git restore --staged <path>` and check
whether `.gitignore` needs an update.

---

## Documentation Ownership

| Changed behavior | Update at least |
| --- | --- |
| Public commands or `ga flow` behavior | `README.md` and `README_CN.md` |
| `FLOW_*` variables or session modes | [docs/development.md section 5](docs/development.md) and `AGENTS.md` |
| Wiki retrieval or curation | [docs/data-governance/data-flow.md](docs/data-governance/data-flow.md) |
| UI imports or chrome behavior | [docs/data-governance/ui-layer-rules.md](docs/data-governance/ui-layer-rules.md) |
| New wiki CLI flag | [scripts/wiki/README.md](scripts/wiki/README.md) |
| Agent skill behavior | `skills/<name>/SKILL.md` |

Keep design details in `docs/`. Keep root README files concise.

---

## Troubleshooting

<details>
<summary><b><code>ga: command not found</code></b></summary>

Run `npm link` from the repository root, or call the CLI directly with
`node ./cli/ga.mjs`.
</details>

<details>
<summary><b><code>zellij: command not found</code></b></summary>

Install Zellij and rerun `ga doctor`. On macOS:

```bash
brew install zellij
```
</details>

<details>
<summary><b>Observer shortcuts do not work</b></summary>

Focus the right pane first, then press shortcuts such as `g`, `i`, or `?`.
</details>

<details>
<summary><b><code>bun test</code> fails</b></summary>

Confirm that the command is running inside `scheme/`. For dependency issues,
try:

```bash
rm -rf node_modules && bun install
```
</details>

<details>
<summary><b>Stale Zellij sessions or orphan processes</b></summary>

```bash
./scripts/flow-run.sh --cleanup
```
</details>

More operations notes: [docs/development.md section 5.4](docs/development.md)
and [README troubleshooting](README.md#troubleshooting).

---

## Release Notes for Maintainers

GUI-Anything currently supports local clone installation only. It is not
published as an npm package. Before creating a GitHub release, use
[docs/release-checklist.md](docs/release-checklist.md).

---

## Get Help

- Bugs and feature requests: GitHub Issues.
- Architecture and extension guide: [docs/development.md](docs/development.md).
- Wiki data flow: [docs/data-governance/data-flow.md](docs/data-governance/data-flow.md).

Small fixes, tests, and documentation improvements are welcome.
