/**
 * ObserverStatusBar — row 1: session meta; row 2: Intent (no activity line).
 */

import type { ReactNode } from 'react';
import { useTuiTheme } from '../theme';
import type { StatusBarModeTheme } from '../themes/resolved-theme';
import { truncateFlowText } from '../../../utils/flow-text';
import type { ObserverStatusBarViewProps } from '../../observer/view-model/shell-chrome.types';
import { resolveIntentChromeDisplay } from '../../observer/view-model/intent-chrome-display';
import { flowSpacing } from './flow-ui/flow-spacing';
import { getObserverMessages, resolveObserverLocale } from '../i18n/observer-messages';
import type { ObserverViewMode } from './observer-hotkeys';

export type ObserverStatusBarProps = ObserverStatusBarViewProps & {
  viewMode?: ObserverViewMode;
};

export function ObserverStatusBar(props: ObserverStatusBarProps): ReactNode {
  const {
    runtimeModel,
    tokenDisplay,
    completedCount,
    errorCount,
    notifyStatus,
    themeNotification,
    terminalWidth,
    fileAccessLine,
    sessionArc,
    liveIntent,
    viewMode,
  } = props;

  const locale = resolveObserverLocale();
  const m = getObserverMessages(locale);
  const statusTheme = useTuiTheme().modes.statusBar;
  const contentWidth = Math.max(32, terminalWidth - flowSpacing.chromePadX * 2);
  const intentDisplay = liveIntent
    ? resolveIntentChromeDisplay({
      intentKey: liveIntent.intentKey,
      title: liveIntent.title,
      locale,
      idleTitle: m.trivialGreetingIntentTitle,
    })
    : null;
  const intentTitle = intentDisplay
    ? truncateFlowText(
      intentDisplay.title,
      Math.max(20, contentWidth - (intentDisplay.badge?.length ?? 0) - 6),
    )
    : '';

  return (
    <box
      style={{
        width: '100%',
        flexShrink: 0,
        backgroundColor: statusTheme.backgroundColor,
        paddingLeft: flowSpacing.chromePadX,
        paddingRight: flowSpacing.chromePadX,
        paddingTop: 0,
        paddingBottom: 0,
        flexDirection: 'column',
        border: ['bottom'],
        borderColor: statusTheme.borderColor,
        borderStyle: 'single',
      }}
    >
      {renderSessionMetaLine({
        runtimeModel,
        tokenDisplay,
        completedCount,
        errorCount,
        fileAccessLine,
        notifyStatus,
        themeNotification,
        contentWidth,
        viewMode,
        m,
        statusTheme,
      })}

      {intentDisplay ? (
        <box
          style={{
            width: '100%',
            flexShrink: 0,
            flexDirection: 'row',
            paddingTop: 0,
            paddingBottom: 0,
            marginTop: 0,
            marginBottom: 0,
          }}
        >
          <text wrapMode="none">
            {intentDisplay.badge ? (
              <>
                <span fg={statusTheme.intentBracketFg}>{'「'}</span>
                <span fg={statusTheme.intentBadgeFg}>{intentDisplay.badge}</span>
                <span fg={statusTheme.intentBracketFg}>{'」 '}</span>
              </>
            ) : (
              <span fg={statusTheme.intentBracketFg}>{'◦ '}</span>
            )}
            <span fg={intentDisplay.isIdle ? statusTheme.idleIntentTitleFg : statusTheme.intentTitleFg}>
              {intentTitle}
            </span>
          </text>
        </box>
      ) : sessionArc ? (
        <text wrapMode="none" fg={statusTheme.sessionArcFg}>
          {truncateFlowText(sessionArc, contentWidth)}
        </text>
      ) : null}
    </box>
  );
}

function renderSessionMetaLine(input: {
  runtimeModel: string;
  tokenDisplay: string;
  completedCount: number;
  errorCount: number;
  fileAccessLine?: string;
  notifyStatus?: string;
  themeNotification?: string;
  contentWidth: number;
  viewMode?: ObserverViewMode;
  m: ReturnType<typeof getObserverMessages>;
  statusTheme: StatusBarModeTheme;
}): ReactNode {
  const viewModeLabel = input.viewMode === 'focus'
    ? input.m.modeFocus
    : input.viewMode === 'workspace'
      ? input.m.modeWorkspace
      : input.m.modeTimeline;
  const modelLabel = truncateFlowText(input.runtimeModel, 22);
  const filePart = input.fileAccessLine
    ? truncateFlowText(`${input.m.statusFiles} ${input.fileAccessLine}`, Math.floor(input.contentWidth * 0.3))
    : '';

  return (
    <box
      style={{
        width: '100%',
        flexDirection: 'row',
        flexShrink: 0,
        justifyContent: input.notifyStatus ? 'space-between' : 'flex-start',
      }}
    >
      <text wrapMode="none">
        <span fg={input.statusTheme.metaFg}>{viewModeLabel}</span>
        <span fg={input.statusTheme.separatorFg}>{' · '}</span>
        <span fg={input.statusTheme.metaFg}>{modelLabel}</span>
        {input.tokenDisplay ? (
          <>
            <span fg={input.statusTheme.separatorFg}>{' · '}</span>
            <span fg={input.statusTheme.metaFg}>{input.tokenDisplay}</span>
          </>
        ) : null}
        <span fg={input.statusTheme.separatorFg}>{' · '}</span>
        <span fg={input.statusTheme.metaFg}>{input.m.statusDone(input.completedCount)}</span>
        {input.errorCount > 0 ? (
          <>
            <span fg={input.statusTheme.separatorFg}>{' · '}</span>
            <span fg={input.statusTheme.errorFg}>{input.m.statusErrors(input.errorCount)}</span>
          </>
        ) : null}
        {filePart ? (
          <>
            <span fg={input.statusTheme.separatorFg}>{' · '}</span>
            <span fg={input.statusTheme.separatorFg}>{filePart}</span>
          </>
        ) : null}
        {input.themeNotification ? (
          <>
            <span fg={input.statusTheme.separatorFg}>{' · '}</span>
            <span fg={input.statusTheme.themeNotificationFg}>{input.themeNotification}</span>
          </>
        ) : null}
      </text>
      {input.notifyStatus ? (
        <text wrapMode="none">
          <span fg={input.statusTheme.notifyFg}>{input.notifyStatus}</span>
        </text>
      ) : null}
    </box>
  );
}
