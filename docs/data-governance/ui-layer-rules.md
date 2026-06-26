# UI Layer Import Rules

Flow observer UI follows **data → services → app(hooks/view-model) → ui** dependency direction.

## Allowed imports

| Directory | May import |
|-----------|------------|
| `scheme/src/app/ui/flow/**` | `data/protocol` (types only), `app/ui/theme`, `app/observer/view-model` (types/props builders only), `utils/*`, `constants/*` |
| `scheme/src/app/ui/flow/flow-ui/**` | Same as above + sibling flow components |
| `scheme/src/app/observer/hooks/**` | `services/*`（含 `session-bundle-service`、`session-index-service`），`data/protocol`，`constants/*` |
| `scheme/src/app/observer/view-model/**` | `data/protocol`, `domain/*` — no services, no OpenTUI, no UI imports |

Chrome prop shapes live in [`shell-chrome.types.ts`](../scheme/src/app/observer/view-model/shell-chrome.types.ts); UI components alias/implement them.

## Forbidden in presentation layer

- `services/*` runtime imports in `app/ui/flow/**` (exception: legacy type-only imports being migrated to protocol)
- `data/wiki/*`, `data/session/*` repository imports in UI components
- Instantiating `Default*Service` outside hooks/container

## Orchestration

- [`LiveObserverContainer.tsx`](../scheme/src/app/observer/LiveObserverContainer.tsx) wires hooks and passes props to [`FlowObserverShell.tsx`](../scheme/src/app/ui/flow/FlowObserverShell.tsx).
- **摘要**：`useExplorationSummaries` → `SummaryOrchestrator`（`services/ai/summary-orchestrator.ts`）；`useSessionIntent` 读 bundle intent。
- **Prior KNOWLEDGE**：`useWikiMatches` → `SessionBundleService.ensureExplorationRetrieval`；热键 `k` 审计同路径。勿在 Observer 用 `matchWikiForExploration`。
- **View-model 无 IO**：`presentation-summaries.ts` 的 `applyLiveSummaryPreview` 由 hook 传入 `bundleSummaryByExplorationId`，不在 view-model 内 `load` bundle。
- Chrome aggregation lives in [`shell-props.ts`](../scheme/src/app/observer/view-model/shell-props.ts).
- Leaf components (`ExplorationCard`, `WikiMatchCard`, etc.) are prop-driven only.
- Focus view chrome lives in `app/ui/flow/graph/FocusView.tsx` (no service imports); Focus projection lives in `app/observer/view-model/focus-guide-view.ts`.
- Flow graph snapshot building lives in `data/protocol/session-flow-projector.ts`; hooks/container pass `FlowGraphSnapshot` to UI.
- Top chrome: `ObserverStatusBar.tsx` — session stats/outcomes (via `shell-props.ts`).
- Bottom chrome: `CommandBar.tsx` — hotkeys only; hidden when `HelpOverlay` is open. No `UnifiedFooter` row.
- `HelpOverlay.tsx`: one multiline `<text>` via `buildHelpBody()`; do not render multiple sibling `<text>` rows (OpenTUI overlaps them in narrow panes).

## Theming

- Prefer `useTuiTheme()` from [`theme.ts`](../scheme/src/app/ui/theme.ts) for UI chrome.
- Mode-specific surfaces should read `theme.modes.<mode>.*` from `resolved-theme.ts` instead of ad hoc `semantic.*` choices.
- `semantic.*` remains the shared fallback for generic labels/fills/status; raw `colors.accent` / `colors.status.*` should stay inside theme builders and compatibility code.
- Reserve `theme.semantic.tint` for active focus; `theme.semantic.destructive` for errors only.
