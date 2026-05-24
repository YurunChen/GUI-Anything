/**
 * FlowObserverShell - Main shell component
 * Responsible for: state management, data fetching, orchestration
 * NOT responsible for: layout details, rendering individual panels
 */

import type { ReactNode } from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useTerminalDimensions, useKeyboard } from '@opentui/react';

import type { ActivityTree } from '../../../domain/types';
import type { PotentialDirection } from '../../../services/ai/flow-summaries';
import type {
  Exploration,
  WikiMatch,
  PersistResult,
  CacheLoadStatus,
  FlowchartHint,
  FlowGraphSnapshot,
} from '../../../data/protocol/observer-protocol';
import type { InspirationRecord } from '../../../data/protocol/observer-protocol';

import { colors, pulseFrames, themeManager, applyTheme, useThemeVersion } from '../theme';
import { LiveObserverFlowBody } from '../live-observer-flow-body';

import { ContextPanel } from './ContextPanel';
import { CommandBar } from './CommandBar';
import { getContextPanelLayout } from '../../../constants/flow-constants';
import type { ContextTab } from './flow-observer-state';
import { buildOutcomeSummary, deriveActivityState } from './activity-state';

interface FlowObserverShellProps {
  explorations: Exploration[];
  tree: ActivityTree | null;
  sessionPath: string;
  sessionId: string;
  tokenDisplay: string;
  runtimeModel: string;
  wikiExtractedCount: number;
  wikiMatch: WikiMatch | null;
  wikiDebugInfo?: string;
  explorationSummaries: Record<string, string>;
  flowchartHints: Record<string, FlowchartHint>;
  graphSnapshot: FlowGraphSnapshot;
  explorationPersistStatus: Record<string, 'saved' | 'skipped' | 'failed' | 'pending'>;
  pendingSummaryCount: number;
  persistResults?: Record<string, PersistResult>;
  cacheStatus?: CacheLoadStatus | null;
  cacheReason?: string;
  replayOnlyHint?: string;
  flowBodyVisible?: boolean;
  potentialDirections: PotentialDirection[];
  directionsStatus: 'idle' | 'generating' | 'ready' | 'insufficient' | 'error';
  directionsMessage: string;
  recentInspirations: InspirationRecord[];
  onSaveInspiration: (text: string) => { saved: boolean; id?: string };
  onSendSnapshot?: (note?: string) => void;
  notifyStatus?: string;
}

export function FlowObserverShell(props: FlowObserverShellProps): ReactNode {
  const flowBodyVisible = props.flowBodyVisible ?? true;
  const { width: terminalWidth } = useTerminalDimensions();
  useThemeVersion();

  const [activeTab, setActiveTab] = useState<ContextTab>(null);
  const [inspirationInputFocused, setInspirationInputFocused] = useState(false);
  const [spinnerFrameIndex, setSpinnerFrameIndex] = useState(0);
  const [observerMode, setObserverMode] = useState<'exploration' | 'flowchart'>('exploration');
  const [showThemeNotification, setShowThemeNotification] = useState(false);

  const blurInspirationInput = useCallback(() => {
    if (inspirationInputFocused) {
      setInspirationInputFocused(false);
    }
  }, [inspirationInputFocused]);

  useEffect(() => {
    if (activeTab !== 'inspiration') {
      setInspirationInputFocused(false);
    }
  }, [activeTab]);

  const handleSaveInspiration = useCallback((text: string) => {
    if (!text.trim()) return;
    const result = props.onSaveInspiration(text);
    if (result.saved) {
      setInspirationInputFocused(false);
    }
  }, [props]);

  const completedCount = props.explorations.filter((e) => e.status === 'complete').length;
  const interruptionErrorCount = props.explorations.filter(
    (e) => (e.errorCounts.system + e.errorCounts.result) > 0
  ).length;
  const persistSavedCount = Object.values(props.explorationPersistStatus).filter((v) => v === 'saved').length;
  const persistSkippedCount = Object.values(props.explorationPersistStatus).filter((v) => v === 'skipped').length;
  const persistFailedCount = Object.values(props.explorationPersistStatus).filter((v) => v === 'failed').length;
  const persistPendingCount = Object.values(props.explorationPersistStatus).filter((v) => v === 'pending').length;
  const summaryCount = Object.keys(props.explorationSummaries).length;

  const activityState = deriveActivityState({
    explorations: props.explorations,
    pendingSummaryCount: props.pendingSummaryCount,
    persistPendingCount,
    directionsStatus: props.directionsStatus,
  });

  useEffect(() => {
    if (!activityState.spinning) return;
    const timer = setInterval(() => {
      setSpinnerFrameIndex((prev) => (prev + 1) % pulseFrames.length);
    }, 160);
    return () => clearInterval(timer);
  }, [activityState.spinning]);

  useKeyboard(useCallback((key: { name: string; ctrl: boolean; meta: boolean; shift?: boolean; preventDefault: () => void }) => {
    if (key.ctrl && key.name === 'q') {
      safeExit();
      return;
    }

    if (inspirationInputFocused) {
      if (key.name === 'escape') {
        setInspirationInputFocused(false);
      }
      return;
    }

    if (key.name === 'i') {
      setActiveTab(activeTab === 'inspiration' ? null : 'inspiration');
      return;
    }

    if (key.name === 'escape') {
      if (activeTab !== 'inspiration') {
        safeExit();
      }
      return;
    }

    if (key.name === 'q') safeExit();
    if (key.name === 'g') {
      setObserverMode((prev) => (prev === 'exploration' ? 'flowchart' : 'exploration'));
    }
    if (key.name === 's' && props.onSendSnapshot) {
      props.onSendSnapshot();
      return;
    }

    const isMorandiKey = key.name === 'J' || (key.name === 'j' && key.shift);
    if (isMorandiKey || key.name === 'j' || key.name === 'k' || key.name === 'l') {
      try {
        let peek;
        if (isMorandiKey) {
          peek = themeManager.nextMorandiTheme();
        } else if (key.name === 'k') {
          peek = themeManager.previousTheme();
        } else if (key.name === 'l') {
          peek = themeManager.toggleLightDark();
        } else {
          peek = themeManager.nextTheme();
        }
        applyTheme(peek);
        setShowThemeNotification(true);
        setTimeout(() => setShowThemeNotification(false), 1500);
      } catch (err) {
        try { process.stderr.write(`Theme switch failed: ${String(err)}\n`); } catch { /* ignore */ }
      }
      return;
    }
  }, [activeTab, inspirationInputFocused, props]));

  const wikiLinkText = props.wikiMatch ? props.wikiMatch.entry.id : '';

  const layout = getContextPanelLayout(terminalWidth);
  const flowBodyWidth = activeTab && !layout.isStacked
    ? Math.max(40, terminalWidth - (typeof layout.flexBasis === 'number' ? layout.flexBasis : 40))
    : terminalWidth;

  return (
    <box style={{ width: '100%', height: '100%', flexDirection: 'column', backgroundColor: colors.bg.primary }}>
      <box
        style={{
          width: '100%',
          backgroundColor: colors.bg.secondary,
          paddingLeft: 1,
          paddingRight: 1,
          flexDirection: 'row',
          justifyContent: 'space-between',
        }}
      >
        <text>
          <span fg={colors.accent.primary}>[{props.runtimeModel}]</span>
          <span fg={colors.fg.dim}>{'  │ '}</span>
          <span fg={colors.status.warning}>{props.tokenDisplay}</span>
          <span fg={colors.fg.dim}>{'  '}</span>
          <span fg={colors.status.success}>{`Done:${completedCount}`}</span>
          <span fg={colors.fg.dim}>{'  '}</span>
          <span fg={interruptionErrorCount > 0 ? colors.status.error : colors.fg.secondary}>
            {`Err:${interruptionErrorCount}`}
          </span>
          {showThemeNotification && (
            <>
              <span fg={colors.fg.dim}>{'  '}</span>
              <span fg={colors.accent.secondary}>{`🎨 ${themeManager.getThemeDisplayName()}`}</span>
            </>
          )}
        </text>
      </box>

      <box style={{ width: '100%', backgroundColor: colors.bg.secondary, paddingLeft: 1, paddingRight: 1, flexDirection: 'row', justifyContent: 'space-between' }}>
        <text fg={colors.fg.dim}>
          {props.sessionPath ? props.sessionPath.split('/').slice(-1)[0].slice(0, 52) : 'Waiting for session...'}
        </text>
        <text>
          {props.notifyStatus && (
            <>
              <span fg={colors.status.success}>{props.notifyStatus}</span>
              <span fg={colors.fg.dim}>{'  │  '}</span>
            </>
          )}
          {props.wikiMatch && (
            <span fg={colors.status.warning}>{`Similar wiki: ${wikiLinkText} ${Math.round(props.wikiMatch.score * 100)}%`}</span>
          )}
          {props.wikiMatch && props.wikiExtractedCount > 0 && <span fg={colors.fg.dim}>{'  │  '}</span>}
          {props.wikiExtractedCount > 0 && (
            <span fg={colors.status.info}>{`Wiki: ${props.wikiExtractedCount} extracted`}</span>
          )}
        </text>
      </box>

      <box style={{ flexGrow: 1, flexDirection: 'row' }} onMouseDown={blurInspirationInput}>
        <box
          style={{
            flexGrow: 1,
            flexDirection: 'column',
            border: !activeTab,
            borderColor: colors.border.normal,
          }}
          onMouseDown={blurInspirationInput}
        >
          <scrollbox
            style={{
              flexGrow: 1,
              padding: 1,
              stickyScroll: true,
              stickyStart: 'bottom',
              viewportCulling: false,
            }}
            onMouseDown={blurInspirationInput}
          >
            {flowBodyVisible && (
              <LiveObserverFlowBody
                sessionId={props.sessionId}
                explorations={props.explorations}
                summaries={props.explorationSummaries}
                flowchartHints={props.flowchartHints}
                graphSnapshot={props.graphSnapshot}
                wikiPersistStatus={props.explorationPersistStatus}
                pendingSummaryCount={props.pendingSummaryCount}
                directionsStatus={props.directionsStatus}
                directionsMessage={props.directionsMessage}
                potentialDirections={props.potentialDirections}
                availableWidth={flowBodyWidth}
                wikiMatch={props.wikiMatch}
                persistResults={props.persistResults}
                cacheStatus={props.cacheStatus}
                cacheReason={props.cacheReason}
                replayOnlyHint={props.replayOnlyHint}
                mode={observerMode}
              />
            )}
          </scrollbox>
        </box>

        <ContextPanel
          activeTab={activeTab}
          terminalWidth={terminalWidth}
          inputFocused={inspirationInputFocused}
          onInputFocusChange={setInspirationInputFocused}
          inspirations={props.recentInspirations}
          onSaveInspiration={handleSaveInspiration}
        />
      </box>

      {props.tree && props.tree.fileAccess.size > 0 && (
        <box style={{ width: '100%', backgroundColor: colors.bg.tertiary, paddingLeft: 1, paddingRight: 1 }}>
          <text fg={colors.fg.muted}>
            {'  '}
            {[...props.tree.fileAccess.entries()]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([path, count]) => {
                const short = path.includes('/') ? path.split('/').pop()! : path;
                const warn = count >= 3 ? ' ⚠' : '';
                return `${short}: ${count}${warn}`;
              })
              .join('  |  ')}
          </text>
        </box>
      )}

      {!activityState.spinning && props.explorations.length > 0 && (
        <box style={{ width: '100%', backgroundColor: colors.bg.tertiary, paddingLeft: 1, paddingRight: 1 }}>
          <text fg={colors.fg.muted}>
            {buildOutcomeSummary({
              summaryCount,
              savedCount: persistSavedCount,
              skippedCount: persistSkippedCount,
              failedCount: persistFailedCount,
              errorCount: interruptionErrorCount,
            })}
          </text>
        </box>
      )}

      <CommandBar
        terminalWidth={terminalWidth}
        inspirationInputFocused={inspirationInputFocused}
        observerMode={observerMode}
        notificationEnabled={!!props.onSendSnapshot}
      />
    </box>
  );
}

function safeExit(): void {
  const restoreSeq = '\u001b[?25h\u001b[?1049l\u001b[?1000l\u001b[?1002l\u001b[?1003l\u001b[?1006l\u001b[?2004l\u001b[0m';
  process.stdout.write(restoreSeq);
  process.exit(0);
}
