/**
 * ObserverStatusBar — row 1: session meta; row 2: Intent (no activity line).
 */

import type { ReactNode } from 'react';
import { semantic } from '../theme';
import { truncateFlowText } from '../../../utils/flow-text';
import type { ObserverStatusBarViewProps } from '../../observer/view-model/shell-chrome.types';
import { resolveIntentChromeDisplay } from '../../observer/view-model/intent-chrome-display';
import { flowSpacing } from './flow-ui/flow-spacing';
import { getObserverMessages, resolveObserverLocale } from '../i18n/observer-messages';

export type ObserverStatusBarProps = ObserverStatusBarViewProps;

export function ObserverStatusBar(props: ObserverStatusBarProps): ReactNode {
  const {
    sessionMode,
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
  } = props;

  const locale = resolveObserverLocale();
  const m = getObserverMessages(locale);
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
        backgroundColor: semantic.fill.base,
        paddingLeft: flowSpacing.chromePadX,
        paddingRight: flowSpacing.chromePadX,
        paddingTop: 0,
        paddingBottom: 0,
        flexDirection: 'column',
        border: ['bottom'],
        borderColor: semantic.separator,
        borderStyle: 'single',
      }}
    >
      {renderSessionMetaLine({
        sessionMode,
        runtimeModel,
        tokenDisplay,
        completedCount,
        errorCount,
        fileAccessLine,
        notifyStatus,
        themeNotification,
        contentWidth,
        m,
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
                <span fg={semantic.label.quaternary}>{'「'}</span>
                <span fg={semantic.tintMuted}>{intentDisplay.badge}</span>
                <span fg={semantic.label.quaternary}>{'」 '}</span>
              </>
            ) : (
              <span fg={semantic.label.quaternary}>{'◦ '}</span>
            )}
            <span fg={intentDisplay.isIdle ? semantic.label.tertiary : semantic.label.primary}>
              {intentTitle}
            </span>
          </text>
        </box>
      ) : sessionArc ? (
        <text wrapMode="none" fg={semantic.label.tertiary}>
          {truncateFlowText(sessionArc, contentWidth)}
        </text>
      ) : null}
    </box>
  );
}

function renderSessionMetaLine(input: {
  sessionMode: ObserverStatusBarViewProps['sessionMode'];
  runtimeModel: string;
  tokenDisplay: string;
  completedCount: number;
  errorCount: number;
  fileAccessLine?: string;
  notifyStatus?: string;
  themeNotification?: string;
  contentWidth: number;
  m: ReturnType<typeof getObserverMessages>;
}): ReactNode {
  const modeLabel = input.sessionMode === 'replay'
    ? input.m.statusModeReplay
    : input.m.statusModeLive;
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
        <span fg={semantic.label.tertiary}>{modeLabel}</span>
        <span fg={semantic.label.quaternary}>{' · '}</span>
        <span fg={semantic.label.tertiary}>{modelLabel}</span>
        {input.tokenDisplay ? (
          <>
            <span fg={semantic.label.quaternary}>{' · '}</span>
            <span fg={semantic.label.tertiary}>{input.tokenDisplay}</span>
          </>
        ) : null}
        <span fg={semantic.label.quaternary}>{' · '}</span>
        <span fg={semantic.label.tertiary}>{input.m.statusDone(input.completedCount)}</span>
        {input.errorCount > 0 ? (
          <>
            <span fg={semantic.label.quaternary}>{' · '}</span>
            <span fg={semantic.destructive}>{input.m.statusErrors(input.errorCount)}</span>
          </>
        ) : null}
        {filePart ? (
          <>
            <span fg={semantic.label.quaternary}>{' · '}</span>
            <span fg={semantic.label.quaternary}>{filePart}</span>
          </>
        ) : null}
        {input.themeNotification ? (
          <>
            <span fg={semantic.label.quaternary}>{' · '}</span>
            <span fg={semantic.label.secondary}>{input.themeNotification}</span>
          </>
        ) : null}
      </text>
      {input.notifyStatus ? (
        <text wrapMode="none">
          <span fg={semantic.label.secondary}>{input.notifyStatus}</span>
        </text>
      ) : null}
    </box>
  );
}
