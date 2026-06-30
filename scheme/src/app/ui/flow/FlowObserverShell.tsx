/**
 * FlowObserverShell - Main shell component
 * Responsible for: layout orchestration and keyboard chrome
 */

import type { ReactNode } from 'react';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTerminalDimensions, useKeyboard } from '@opentui/react';

import type { ActivityTree } from '../../../domain/types';
import type {
  Exploration,
  PersistResult,
  FlowGraphSnapshot,
  SessionScopedId,
  SummaryItem,
  SessionIntentState,
  InspirationRecord,
  WikiMatch,
} from '../../../data/protocol/observer-protocol';
import type { WorkspaceTreeSnapshot } from '../../../data/protocol/workspace-tree';
import type { SessionPresentationMode } from '../../../services/session/session-runtime-policy';
import type { WikiWriteChromeView } from '../../observer/view-model/wiki-write-chrome';

import { themeManager, applyTheme, useThemeVersion, useTuiTheme } from '../theme';
import { useThemeSwitchBanner } from '../themes/use-theme-switch-banner';
import { LiveObserverFlowBody } from '../live-observer-flow-body';
import { buildShellChromeProps } from '../../observer/view-model/shell-props';
import { getObserverMessages } from '../i18n/observer-messages';

import { CommandBar } from './CommandBar';
import { ExportStatusBar } from './ExportStatusBar';
import { HelpOverlay } from './HelpOverlay';
import { PersonalityStrip } from './PersonalityStrip';
import type { PersonalityStripInfo } from '../../observer/view-model/personality-strip-view';
import { nextObserverViewMode, type ObserverHotkeyContext, type ObserverViewMode } from './observer-hotkeys';
import { dispatchObserverKey } from './observer-key-dispatch';
import { NotesSidePanel } from './NotesSidePanel';
import {
  NOTES_SIDEBAR_MIN_TERMINAL_COLS,
  OBSERVER_MIN_TERMINAL_COLS,
  OBSERVER_MIN_TERMINAL_ROWS,
  isObserverTerminalTooSmall,
  resolveNotesSidebarWidth,
} from '../../../constants/flow-constants';
import { ObserverStatusBar } from './ObserverStatusBar';
import { flowSpacing } from './flow-ui/flow-spacing';
import { useFlowMotionFrame } from '../hooks/useFlowMotion';

interface FlowObserverShellProps {
  explorations: Exploration[];
  tree: ActivityTree | null;
  sessionId: string;
  tokenDisplay: string;
  runtimeModel: string;
  wikiExtractedCount: number;
  explorationSummaries: Record<string, string>;
  graphSnapshot: FlowGraphSnapshot;
  explorationPersistStatus: Record<string, 'saved' | 'updated' | 'skipped' | 'failed' | 'pending'>;
  pendingSummaryCount: number;
  pendingByExplorationId?: Record<string, boolean>;
  persistResults?: Record<string, PersistResult>;
  wikiWriteChromeByExploration?: Record<string, WikiWriteChromeView>;
  wikiMatchesByExploration: Record<string, WikiMatch | null>;
  sessionPresentationMode?: SessionPresentationMode;
  sessionBannerHint?: string;
  summaryItems?: Record<SessionScopedId, SummaryItem>;
  workspaceTree?: WorkspaceTreeSnapshot | null;
  sessionIntent?: SessionIntentState | null;
  flowBodyVisible?: boolean;
  recentInspirations: InspirationRecord[];
  onSaveInspiration: (text: string) => { saved: boolean; id?: string };
  onEnableNotify?: () => void;
  onFileWikiAudit?: () => { filed: boolean; targetId?: string };
  onExportHtml?: (force?: boolean) => void;
  exportStatus?: string;
  notifyStatus?: string;
  personalityStripInfo?: PersonalityStripInfo;
}

function resolveSpinnerIntervalMs(): number | undefined {
  const raw = (process.env.FLOW_NO_ANIMATIONS || '').trim().toLowerCase();
  if (raw === '1' || raw === 'true' || raw === 'yes') return 400;
  return undefined;
}

export function FlowObserverShell(props: FlowObserverShellProps): ReactNode {
  const flowBodyVisible = props.flowBodyVisible ?? true;
  const { width: terminalWidth, height: terminalHeight } = useTerminalDimensions();
  useThemeVersion();
  const tuiTheme = useTuiTheme();
  const { banner: themeSwitchBanner, trigger: triggerThemeSwitchBanner } = useThemeSwitchBanner();
  const messages = getObserverMessages();
  const [showNotes, setShowNotes] = useState(false);
  const [inspirationInputFocused, setInspirationInputFocused] = useState(false);
  const [showThemeNotification, setShowThemeNotification] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [observerMode, setObserverMode] = useState<ObserverViewMode>('timeline');
  const [calmMode, setCalmMode] = useState(false);
  const [chromeHint, setChromeHint] = useState<string | undefined>();
  const chromeHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const spinnerIntervalMs = useMemo(() => resolveSpinnerIntervalMs(), []);
  const chromeMotionActive = Boolean(props.personalityStripInfo || props.exportStatus);
  const chromeMotionFrame = useFlowMotionFrame(chromeMotionActive, spinnerIntervalMs ?? 720);
  const notesSidebarWidth = useMemo(
    () => (showNotes ? resolveNotesSidebarWidth(terminalWidth) : 0),
    [showNotes, terminalWidth],
  );
  const timelineWidth = useMemo(
    () => Math.max(24, terminalWidth - notesSidebarWidth - flowSpacing.contentPadX * 2),
    [terminalWidth, notesSidebarWidth],
  );
  const terminalTooSmall = isObserverTerminalTooSmall(terminalWidth, terminalHeight);

  const flashChromeHint = useCallback((text: string) => {
    if (chromeHintTimerRef.current) {
      clearTimeout(chromeHintTimerRef.current);
    }
    setChromeHint(text);
    chromeHintTimerRef.current = setTimeout(() => {
      setChromeHint(undefined);
      chromeHintTimerRef.current = null;
    }, 4000);
  }, []);

  useEffect(() => () => {
    if (chromeHintTimerRef.current) clearTimeout(chromeHintTimerRef.current);
  }, []);

  useEffect(() => {
    if (!showNotes) {
      setInspirationInputFocused(false);
    }
  }, [showNotes]);

  const handleSaveInspiration = useCallback((text: string) => {
    if (!text.trim()) return;
    const result = props.onSaveInspiration(text);
    if (result.saved) {
      setInspirationInputFocused(false);
    }
  }, [props]);

  const chrome = buildShellChromeProps({
    sessionId: props.sessionId,
    sessionPresentationMode: props.sessionPresentationMode ?? 'live',
    explorations: props.explorations,
    tree: props.tree,
    runtimeModel: props.runtimeModel,
    tokenDisplay: props.tokenDisplay,
    notifyStatus: chromeHint ?? props.notifyStatus,
    themeNotification: themeSwitchBanner
      ? `${themeSwitchBanner.frame} ${themeSwitchBanner.familyLabel} · ${themeSwitchBanner.themeLabel}`
      : showThemeNotification
        ? themeManager.getThemeDisplayName()
        : undefined,
    terminalWidth,
    pendingSummaryCount: props.pendingSummaryCount,
    explorationSummaries: props.explorationSummaries,
    explorationPersistStatus: props.explorationPersistStatus,
    explorationPersistResults: props.persistResults,
    summaryItems: props.summaryItems,
    sessionIntent: props.sessionIntent,
  });
  const hotkeyContext: ObserverHotkeyContext = useMemo(() => ({
    footerMode: inspirationInputFocused
      ? 'notes-input'
      : showNotes
        ? 'notes'
        : 'default',
    observerMode,
    calmMode,
    notifyAvailable: !!props.onEnableNotify,
    wikiAuditAvailable: !!props.onFileWikiAudit,
    htmlExportAvailable: !!props.onExportHtml,
  }), [
    calmMode,
    inspirationInputFocused,
    observerMode,
    props.onExportHtml,
    props.onFileWikiAudit,
    props.onEnableNotify,
    showNotes,
  ]);

  const handleFileWikiAudit = useCallback(() => {
    if (!props.onFileWikiAudit) return;
    const result = props.onFileWikiAudit();
    if (result.filed && result.targetId) {
      flashChromeHint(messages.wikiAuditFiled(result.targetId));
    } else {
      flashChromeHint(messages.wikiAuditNoMatch);
    }
  }, [flashChromeHint, messages, props]);

  const handleOpenHtml = useCallback(() => {
    props.onExportHtml?.(false);
  }, [props]);

  const applyThemeKind = useCallback((kind: 'morandi' | 'prev' | 'next') => {
    try {
      const peek = kind === 'morandi'
        ? themeManager.nextMorandiTheme()
        : kind === 'prev'
          ? themeManager.previousTheme()
          : themeManager.nextTheme();
      applyTheme(peek);
      triggerThemeSwitchBanner(peek, themeManager.getThemeDisplayName(peek));
      setShowThemeNotification(true);
      setTimeout(() => setShowThemeNotification(false), 1500);
    } catch (err) {
      try { process.stderr.write(`Theme switch failed: ${String(err)}\n`); } catch { /* ignore */ }
    }
  }, [triggerThemeSwitchBanner]);

  const toggleNotes = useCallback(() => {
    setShowNotes((prev) => {
      if (prev) return false;
      if (resolveNotesSidebarWidth(terminalWidth) === 0) {
        flashChromeHint(messages.notesTooNarrow(NOTES_SIDEBAR_MIN_TERMINAL_COLS));
        return false;
      }
      return true;
    });
  }, [flashChromeHint, messages, terminalWidth]);

  useKeyboard(useCallback((key: { name: string; ctrl: boolean; meta: boolean; shift?: boolean }) => {
    const action = dispatchObserverKey(key, {
      showHelp,
      showNotes,
      inspirationInputFocused,
      notifyAvailable: !!props.onEnableNotify,
      wikiAuditAvailable: !!props.onFileWikiAudit,
      htmlExportAvailable: !!props.onExportHtml,
    });
    if (!action) return;

    switch (action.type) {
      case 'exit':
        safeExit();
        break;
      case 'close_help':
        setShowHelp(false);
        break;
      case 'toggle_help':
        setShowHelp((prev) => !prev);
        break;
      case 'close_notes_input':
        setInspirationInputFocused(false);
        break;
      case 'toggle_notes':
        toggleNotes();
        break;
      case 'close_notes':
        setShowNotes(false);
        break;
      case 'toggle_calm':
        setCalmMode((prev) => !prev);
        break;
      case 'toggle_mode':
        setObserverMode(nextObserverViewMode);
        break;
      case 'enable_notify':
        props.onEnableNotify?.();
        break;
      case 'file_wiki_audit':
        handleFileWikiAudit();
        break;
      case 'open_html':
        handleOpenHtml();
        break;
      case 'regenerate_html':
        props.onExportHtml?.(true);
        break;
      case 'theme':
        applyThemeKind(action.kind);
        break;
      default:
        break;
    }
  }, [
    applyThemeKind,
    handleFileWikiAudit,
    handleOpenHtml,
    inspirationInputFocused,
    observerMode,
    props,
    showHelp,
    showNotes,
    toggleNotes,
  ]));

  return (
    <box style={{ width: '100%', height: '100%', flexDirection: 'column', backgroundColor: tuiTheme.semantic.fill.base }}>
      <ObserverStatusBar
        {...chrome.statusBar}
        viewMode={observerMode}
      />

      <box style={{ flexGrow: 1, flexDirection: 'row', minHeight: 0 }}>
        <box style={{ flexGrow: 1, flexDirection: 'column', minWidth: 0 }}>
          <scrollbox
            style={{
              flexGrow: 1,
              paddingLeft: flowSpacing.contentPadX,
              paddingRight: flowSpacing.contentPadX,
              paddingTop: 1,
              paddingBottom: 0,
              stickyScroll: true,
              stickyStart: 'bottom',
              viewportCulling: false,
            }}
          >
            {!flowBodyVisible ? (
              <box style={{ flexDirection: 'column' }}>
                <text fg={tuiTheme.semantic.label.primary}>{messages.replayOnlyTitle}</text>
                <text fg={tuiTheme.semantic.label.secondary} style={{ marginTop: 1 }}>
                  {messages.replayOnlyBody}
                </text>
              </box>
            ) : terminalTooSmall ? (
              <box style={{ flexDirection: 'column' }}>
                <text fg={tuiTheme.semantic.warning}>
                  {messages.observerTooSmall(OBSERVER_MIN_TERMINAL_COLS, OBSERVER_MIN_TERMINAL_ROWS)}
                </text>
                <text fg={tuiTheme.semantic.label.quaternary} style={{ marginTop: 1 }}>
                  {messages.observerPaneFocus}
                </text>
              </box>
            ) : (
              <LiveObserverFlowBody
                explorations={props.explorations}
                summaries={props.explorationSummaries}
                summaryItems={props.summaryItems}
                workspaceTree={props.workspaceTree}
                graphSnapshot={props.graphSnapshot}
                wikiPersistResults={props.persistResults}
                wikiWriteChromeByExploration={props.wikiWriteChromeByExploration}
                wikiMatchesByExploration={props.wikiMatchesByExploration}
                pendingSummaryCount={props.pendingSummaryCount}
                pendingByExplorationId={props.pendingByExplorationId}
                availableWidth={timelineWidth}
                availableHeight={Math.max(8, terminalHeight - 8)}
                sessionBannerHint={props.sessionBannerHint}
                mode={observerMode}
                calmMode={calmMode}
                spinnerIntervalMs={spinnerIntervalMs}
              />
            )}
          </scrollbox>
        </box>

        {showNotes && notesSidebarWidth > 0 && (
          <NotesSidePanel
            width={notesSidebarWidth}
            inspirations={props.recentInspirations}
            inputFocused={inspirationInputFocused}
            onInputFocusChange={setInspirationInputFocused}
            onSaveInspiration={handleSaveInspiration}
          />
        )}
      </box>

      {showHelp && <HelpOverlay hotkeyContext={hotkeyContext} />}

      {!showHelp && (
        <>
          <PersonalityStrip
            personality={props.personalityStripInfo}
            terminalWidth={terminalWidth}
            motionFrame={chromeMotionFrame}
          />
          <ExportStatusBar
            status={props.exportStatus}
            terminalWidth={terminalWidth}
            motionFrame={chromeMotionFrame}
          />
          <CommandBar
            terminalWidth={terminalWidth}
            context={hotkeyContext}
            active={Boolean(chromeHint || props.exportStatus || themeSwitchBanner || showThemeNotification)}
          />
        </>
      )}
    </box>
  );
}

function safeExit(): void {
  const restoreSeq = '\u001b[?25h\u001b[?1049l\u001b[?1000l\u001b[?1002l\u001b[?1003l\u001b[?1006l\u001b[?2004l\u001b[0m';
  process.stdout.write(restoreSeq);
  process.exit(0);
}
