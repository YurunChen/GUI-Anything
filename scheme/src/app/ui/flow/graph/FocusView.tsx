import type { ReactNode } from 'react';
import { memo, useMemo } from 'react';
import type { FlowGraphSnapshot } from '../../../../data/protocol/observer-protocol';
import {
  buildFocusDisplay,
  type FocusDisplayRow,
} from '../../../observer/view-model/focus-guide-view';
import { getObserverMessages, resolveObserverLocale } from '../../i18n/observer-messages';
import { flowSpacing } from '../flow-ui/flow-spacing';
import { useThemeMotionFrame, useThemeVersion, useTuiTheme } from '../../theme';
import type { ThemeChrome } from '../../themes/theme-profile';
import { resolveChromeFrame } from '../../themes/theme-profile';
import { buildGraphTheme, type GraphTheme } from './graph-theme';
import { lineDisplayWidth, truncateFlowText } from '../../../../utils/flow-text';

interface FocusViewProps {
  snapshot: FlowGraphSnapshot;
  availableWidth: number;
}

const centeredColumnStyle = {
  width: '100%' as const,
  flexDirection: 'column' as const,
};

export const FocusView = memo(function FocusView(props: FocusViewProps): ReactNode {
  const { snapshot, availableWidth } = props;
  const themeVersion = useThemeVersion();
  const tuiTheme = useTuiTheme();
  const chrome = tuiTheme.chrome;
  const motionFrame = useThemeMotionFrame();
  const graphTheme = useMemo(() => buildGraphTheme(tuiTheme), [themeVersion, tuiTheme]);
  const locale = resolveObserverLocale();
  const display = useMemo(
    () => buildFocusDisplay(snapshot, locale),
    [snapshot, locale],
  );

  if (snapshot.nodes.length === 0) {
    const m = getObserverMessages();
    return (
      <box style={centeredColumnStyle}>
        <text fg={graphTheme.color.muted}>{m.focusEmpty}</text>
      </box>
    );
  }

  const contentWidth = Math.max(24, availableWidth - flowSpacing.contentPadX * 2);

  return (
    <box
      style={{
        width: '100%' as const,
        flexDirection: 'column',
        paddingLeft: flowSpacing.contentPadX,
        paddingRight: flowSpacing.contentPadX,
      }}
    >
      <box style={centeredColumnStyle}>
        {display.mainRows.length > 0 ? (
          <text fg={graphTheme.color.muted} wrapMode="none">MAIN</text>
        ) : null}
        {display.mainRows.map((row) => renderFocusRow(
          graphTheme,
          chrome,
          row,
          motionFrame,
          contentWidth,
          'main',
        ))}
        {display.branchRows.length > 0 ? (
          <text fg={graphTheme.color.muted} wrapMode="none" style={{ marginTop: 1 }}>BRANCHES</text>
        ) : null}
        {display.branchRows.map((row) => renderFocusRow(
          graphTheme,
          chrome,
          row,
          motionFrame,
          contentWidth,
          'branch',
        ))}
      </box>
    </box>
  );
});

function renderFocusRow(
  theme: GraphTheme,
  chrome: ThemeChrome,
  row: FocusDisplayRow,
  motionFrame: number,
  contentWidth: number,
  section: 'main' | 'branch',
): ReactNode {
  const connector = row.isFocus
    ? resolveChromeFrame(chrome.focusConnectorFrames, chrome.focusConnector, motionFrame)
    : '';
  const marker = row.isFocus ? '▶ ' : '  ';
  const relationship = section === 'branch'
    ? `${relationshipGlyph(row.relationship)} ${relationshipLabel(row.relationship)} `
    : '';
  const indent = '  '.repeat(Math.max(0, row.depth));
  const badge = `[${row.badge ?? 'General'}]`;
  const activeSuffix = row.isActive
    ? (row.isFocus
      ? resolveChromeFrame(chrome.focusActiveFrames, chrome.focusActiveSuffix, motionFrame)
      : ` ${theme.chars.normal}`)
    : '';
  const title = formatFocusRowTitle({
    title: row.title,
    suffix: activeSuffix,
    budget: contentWidth
      - lineDisplayWidth(connector)
      - lineDisplayWidth(marker)
      - lineDisplayWidth(indent)
      - lineDisplayWidth(relationship)
      - lineDisplayWidth(badge),
  });
  return (
    <box
      key={row.id}
      style={{
        width: '100%' as const,
        flexDirection: 'row',
        marginTop: 0,
        paddingLeft: 0,
      }}
    >
      <text fg={theme.color.trunk} wrapMode="none">{connector}</text>
      <text fg={row.isFocus ? theme.color.statusRunning : theme.color.muted} wrapMode="none">
        {marker}{indent}{relationship}
      </text>
      <text fg={theme.color.branchAlternative} wrapMode="none">
        {badge}
      </text>
      <text fg={row.isFocus ? theme.color.statusRunning : theme.color.muted} wrapMode="none">
        {title}
      </text>
    </box>
  );
}

function relationshipGlyph(relationship: FocusDisplayRow['relationship']): string {
  if (relationship === 'repair') return '↺';
  if (relationship === 'side') return '↗';
  if (relationship === 'merge') return '↘';
  return '•';
}

function relationshipLabel(relationship: FocusDisplayRow['relationship']): string {
  if (relationship === 'repair') return 'repair';
  if (relationship === 'side') return 'side';
  if (relationship === 'merge') return 'merge';
  return 'main';
}

export function formatFocusRowTitle(input: {
  title: string;
  suffix: string;
  budget: number;
}): string {
  return truncateFlowText(` ${input.title}${input.suffix}`, Math.max(8, input.budget));
}
