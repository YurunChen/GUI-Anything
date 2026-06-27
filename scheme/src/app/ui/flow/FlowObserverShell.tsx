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
  FlowchartHint,
  FlowGraphSnapshot,
  SessionScopedId,
  SummaryItem,
  SessionIntentState,
  InspirationRecord,
} from '../../../data/protocol/observer-protocol';
import type { SessionPresentationMode } from '../../../services/session/session-runtime-policy';
import type { WikiWriteChromeView } from '../../observer/view-model/wiki-write-chrome';

import { semantic, themeManager, applyTheme, useThemeVersion } from '../theme';
import { LiveObserverFlowBody } from '../live-observer-flow-body';
import { buildShellChromeProps } from '../../observer/view-model/shell-props';
import { getObserverMessages } from '../i18n/observer-messages';

import { CommandBar } from './CommandBar';
import { HelpOverlay } from './HelpOverlay';
import type { ObserverHotkeyContext } from './observer-hotkeys';
import { dispatchObserverKey } from './observer-key-dispatch';
import { NotesSidePanel } from './NotesSidePanel';
import {
  NOTES_SIDEBAR_MIN_TERMINAL_COLS,
  resolveNotesSidebarWidth,
} from '../../../constants/flow-constants';
import { ObserverStatusBar } from './ObserverStatusBar';
import { flowSpacing } from './flow-ui/flow-spacing';

interface FlowObserverShellProps {
  explorations: Exploration[];
  tree: ActivityTree | null;
  sessionId: string;
  sessionPath?: string;
  allowWikiLiveSearch?: boolean;
  tokenDisplay: string;
  runtimeModel: string;
  wikiExtractedCount: number;
  explorationSummaries: Record<string, string>;
  flowchartHints: Record<string, FlowchartHint>;
  graphSnapshot: FlowGraphSnapshot;
  explorationPersistStatus: Record<string, 'saved' | 'updated' | 'skipped' | 'failed' | 'pending'>;
  pendingSummaryCount: number;
  pendingByExplorationId?: Record<string, boolean>;
  persistResults?: Record<string, PersistResult>;
  wikiWriteChromeByExploration?: Record<string, WikiWriteChromeView>;
  sessionPresentationMode?: SessionPresentationMode;
  sessionBannerHint?: string;
  summaryItems?: Record<SessionScopedId, SummaryItem>;
  sessionIntent?: SessionIntentState | null;
  flowBodyVisible?: boolean;
  recentInspirations: InspirationRecord[];
  onSaveInspiration: (text: string) => { saved: boolean; id?: string };
  onSendSnapshot?: (note?: string) => void;
  onFileWikiAudit?: () => { filed: boolean; targetId?: string };
  onExportHtml?: (force?: boolean) => void;
  exportStatus?: string;
  notifyStatus?: string;
}

function resolveSpinnerIntervalMs(): number {
  const raw = (process.env.FLOW_NO_ANIMATIONS || '').trim().toLowerCase();
  if (raw === '1' || raw === 'true' || raw === 'yes') return 400;
  return 160;
}

export function FlowObserverShell(props: FlowObserverShellProps): ReactNode {
  const flowBodyVisible = props.flowBodyVisible ?? true;
  const { width: terminalWidth } = useTerminalDimensions();
  useThemeVersion();
  const messages = getObserverMessages();

  const [showNotes, setShowNotes] = useState(false);
  const [inspirationInputFocused, setInspirationInputFocused] = useState(false);
  const [showThemeNotification, setShowThemeNotification] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [observerMode, setObserverMode] = useState<'exploration' | 'flowchart'>('exploration');
  const [calmMode, setCalmMode] = useState(false);
  const [chromeHint, setChromeHint] = useState<string | undefined>();
  const chromeHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const spinnerIntervalMs = useMemo(() => resolveSpinnerIntervalMs(), []);
  const notesSidebarWidth = useMemo(
    () => (showNotes ? resolveNotesSidebarWidth(terminalWidth) : 0),
    [showNotes, terminalWidth],
  );
  const timelineWidth = useMemo(
    () => Math.max(24, terminalWidth - notesSidebarWidth - flowSpacing.contentPadX * 2),
    [terminalWidth, notesSidebarWidth],
  );

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
    notifyStatus: chromeHint ?? props.exportStatus ?? props.notifyStatus,
    themeNotification: showThemeNotification ? themeManager.getThemeDisplayName() : undefined,
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
    notifyAvailable: !!props.onSendSnapshot,
    wikiAuditAvailable: !!props.onFileWikiAudit,
    exportAvailable: !!props.onExportHtml,
  }), [
    calmMode,
    inspirationInputFocused,
    observerMode,
    props.onExportHtml,
    props.onFileWikiAudit,
    props.onSendSnapshot,
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

  const applyThemeKind = useCallback((kind: 'morandi' | 'prev' | 'next') => {
    try {
      let peek;
      if (kind === 'morandi') {
        peek = themeManager.nextMorandiTheme();
      } else if (kind === 'prev') {
        peek = themeManager.previousTheme();
      } else {
        peek = themeManager.nextTheme();
      }
      applyTheme(peek);
      setShowThemeNotification(true);
      setTimeout(() => setShowThemeNotification(false), 1500);
    } catch (err) {
      try { process.stderr.write(`Theme switch failed: ${String(err)}\n`); } catch { /* ignore */ }
    }
  }, []);

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
      notifyAvailable: !!props.onSendSnapshot,
      wikiAuditAvailable: !!props.onFileWikiAudit,
      exportAvailable: !!props.onExportHtml,
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
        setObserverMode((prev) => (prev === 'exploration' ? 'flowchart' : 'exploration'));
        break;
      case 'send_snapshot':
        props.onSendSnapshot?.();
        break;
      case 'file_wiki_audit':
        handleFileWikiAudit();
        break;
      case 'export_html':
        props.onExportHtml?.(false);
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
    inspirationInputFocused,
    props,
    showHelp,
    showNotes,
    toggleNotes,
  ]));

  return (
    <box style={{ width: '100%', height: '100%', flexDirection: 'column', backgroundColor: semantic.fill.base }}>
      <ObserverStatusBar {...chrome.statusBar} />

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
                <text fg={semantic.label.primary}>{messages.replayOnlyTitle}</text>
                <text fg={semantic.label.secondary} style={{ marginTop: 1 }}>
                  {messages.replayOnlyBody}
                </text>
              </box>
            ) : (
              <LiveObserverFlowBody
                sessionId={props.sessionId}
                sessionPath={props.sessionPath}
                allowWikiLiveSearch={props.allowWikiLiveSearch}
                explorations={props.explorations}
                summaries={props.explorationSummaries}
                summaryItems={props.summaryItems}
                flowchartHints={props.flowchartHints}
                graphSnapshot={props.graphSnapshot}
                wikiPersistStatus={props.explorationPersistStatus}
                wikiPersistResults={props.persistResults}
                wikiWriteChromeByExploration={props.wikiWriteChromeByExploration}
                pendingSummaryCount={props.pendingSummaryCount}
                pendingByExplorationId={props.pendingByExplorationId}
                availableWidth={timelineWidth}
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
        <CommandBar
          terminalWidth={terminalWidth}
          context={hotkeyContext}
        />
      )}
    </box>
  );
}

function safeExit(): void {
  const restoreSeq = '\u001b[?25h\u001b[?1049l\u001b[?1000l\u001b[?1002l\u001b[?1003l\u001b[?1006l\u001b[?2004l\u001b[0m';
  process.stdout.write(restoreSeq);
  process.exit(0);
}
