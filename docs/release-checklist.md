# Local Release Checklist

This checklist keeps clone-based GUI-Anything releases consistent. The project
is installed from a local Git clone; it is not published to the npm registry.

## 1) Validate Locally

- Run `npm run verify`
- Run `cd scheme && bun run typecheck`
- Run `cd scheme && bun test`
- Run `ga doctor` in a clean shell
- Run `ga flow --help` and `ga flow --continue --help` path checks

## 2) Smoke Test Clone Install

- From a fresh clone, run `./scripts/setup.sh`
- Confirm `npm link` creates a working `ga` command
- Confirm project-local `.claude/skills/llm-wiki` and `.agents/skills/llm-wiki` resolve

## 3) Smoke Test Install Paths

- `ga doctor`
- `ga flow --help`
- `node ./cli/ga.mjs doctor`
- Ensure public docs only mention `ga flow` and `ga doctor`

## 4) Tag GitHub Release

- Bump version in root `package.json` if needed
- Tag release and update changelog/release notes

## 5) Post-Release Verification

- Fresh clone install check
- `ga doctor` passes with expected dependencies
- `ga flow` starts and launches the two-pane workflow successfully
