# Release Checklist

This checklist keeps `gui-anything` release quality consistent.

## 1) Validate Locally

- Run `npm run verify`
- Run `cd scheme && bun run typecheck`
- Run `cd scheme && bun test`
- Run `ga doctor` in a clean shell
- Run `ga flow --help` and `ga flow --continue --help` path checks

## 2) Dry-Run Package

- Run `npm run release:dry-run`
- Confirm `cli/`, `scripts/`, `scheme/`, and `README.md` are included
- Confirm `bin.ga` points to `cli/ga.mjs`

## 3) Smoke Test Install Paths

- One-off: `npx gui-anything@latest doctor`
- Global: `npm i -g gui-anything && ga doctor`
- Ensure public docs only mention `ga flow` and `ga doctor`

## 4) Publish

- Bump version in root `package.json`
- Run `npm run release:publish`
- Tag release and update changelog

## 5) Post-Release Verification

- Fresh machine (or clean container) install check
- `ga doctor` passes with expected dependencies
- `ga flow` starts and launches the two-pane workflow successfully
