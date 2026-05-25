# UI Layer Import Rules

Flow observer UI follows **data → services → app(hooks/view-model) → ui** dependency direction.

## Allowed imports

| Directory | May import |
|-----------|------------|
| `scheme/src/app/ui/flow/**` | `data/protocol` (types only), `app/ui/theme`, `app/observer/view-model` (types/props builders only), `utils/*`, `constants/*` |
| `scheme/src/app/ui/flow/flow-ui/**` | Same as above + sibling flow components |
| `scheme/src/app/observer/hooks/**` | `services/*`, `data/protocol`, `constants/*` |
| `scheme/src/app/observer/view-model/**` | `data/protocol`, `domain/*` — no services, no OpenTUI, no UI imports |

Chrome prop shapes live in [`shell-chrome.types.ts`](../scheme/src/app/observer/view-model/shell-chrome.types.ts); UI components alias/implement them.

## Forbidden in presentation layer

- `services/*` runtime imports in `app/ui/flow/**` (exception: legacy type-only imports being migrated to protocol)
- `data/wiki/*`, `data/session/*` repository imports in UI components
- Instantiating `Default*Service` outside hooks/container

## Orchestration

- [`LiveObserverContainer.tsx`](../scheme/src/app/observer/LiveObserverContainer.tsx) wires hooks and passes props to [`FlowObserverShell.tsx`](../scheme/src/app/ui/flow/FlowObserverShell.tsx).
- Chrome aggregation lives in [`shell-props.ts`](../scheme/src/app/observer/view-model/shell-props.ts).
- Leaf components (`ExplorationCard`, `WikiMatchCard`, etc.) are prop-driven only.
- Flowchart layout math lives in `app/ui/flow/graph/flow-graph-layout.ts` (no service imports); `FlowGraphView.tsx` only consumes layout output.
- Flowchart snapshot building lives in `app/observer/view-model/flow-graph-builder.ts` (data/protocol only); hooks/container pass `FlowGraphSnapshot` to UI.
- Top chrome: `ObserverStatusBar.tsx` — session stats/outcomes (via `shell-props.ts`).
- Bottom chrome: `CommandBar.tsx` — hotkeys only; hidden when `HelpOverlay` is open. No `UnifiedFooter` row.
- `HelpOverlay.tsx`: one multiline `<text>` via `buildHelpBody()`; do not render multiple sibling `<text>` rows (OpenTUI overlaps them in narrow panes).

## Theming

- Prefer `semantic.*` from [`theme.ts`](../scheme/src/app/ui/theme.ts) over raw `colors.accent` / `colors.status.success` for chrome and labels.
- Reserve `semantic.tint` for active focus; `semantic.destructive` for errors only.
