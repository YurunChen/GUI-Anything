/**
 * FlowObserverShell - Main shell component
 * Responsible for: state management, data fetching, orchestration
 * NOT responsible for: layout details, rendering individual panels
 * 
 * Architecture: Thin shell, delegates to ContextPanel/CommandBar/FlowBody
 */

import type { ReactNode } from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useTerminalDimensions, useKeyboard } from '@opentui/react';

import type { ActivityTree } from '../../../domain/types';
import type { PotentialDirection, ExplorationHistoryContext } from '../../../services/ai/flow-summaries';
import type { Exploration, WikiPersistMeta, WikiMatch, SummaryItem, PersistResult, CacheLoadStatus } from '../../../data/protocol/observer-protocol';
import type { InspirationRecord } from '../../../services/wiki/auto-extractor';

import { colors, phaseIcons, phaseColors } from '../theme';
import { useViewMode } from '../hooks';
import { LiveObserverFlowBody } from '../live-observer-flow-body';
import { treeNodes, TreeNode } from '../tree-node';

import { ContextPanel } from './ContextPanel';
import { CommandBar } from './CommandBar';
import { OBSERVER_POLL_MS, COMPACT_LAYOUT_WIDTH, getContextPanelLayout } from '../../../constants/flow-constants';
import { extractCommandsFromNodes, extractPathsFromNodes, formatCompactTokens, getContextWindowTokens } from './flow-utils';
import type { ContextTab } from './flow-observer-state';

// Shell props - data from parent or hooks
interface FlowObserverShellProps {
  // Data layer (from polling)
  explorations: Exploration[];
  tree: ActivityTree | null;
  sessionPath: string;
  sessionId: string;
  tokenDisplay: string;
  runtimeModel: string;
  wikiExtractedCount: number;
  wikiMatch: WikiMatch | null;
  
  // Summary layer
  explorationSummaries: Record<string, string>;
  explorationPersistStatus: Record<string, 'saved' | 'skipped' | 'failed' | 'pending'>;
  pendingSummaryCount: number;
  
  // Provenance layer (Phase 0: UI badges)
  summarySources?: Record<string, SummaryItem['source']>;
  summaryReasons?: Record<string, string>;
  persistResults?: Record<string, PersistResult>;
  cacheStatus?: CacheLoadStatus | null;
  cacheReason?: string;
  
  // Direction layer
  potentialDirections: PotentialDirection[];
  directionsStatus: 'idle' | 'generating' | 'ready' | 'insufficient' | 'error';
  directionsMessage: string;
  onTriggerDirections?: () => void;

  // Inspiration layer
  recentInspirations: InspirationRecord[];
  onSaveInspiration: (text: string) => { saved: boolean; id?: string };

  // Notification layer
  onSendSnapshot?: (note?: string) => void;
  notifyStatus?: string;
}

export function FlowObserverShell(props: FlowObserverShellProps): ReactNode {
  const { width: terminalWidth } = useTerminalDimensions();
  const { viewMode, toggleViewMode } = useViewMode('flow');
  
  // Local UI state
  const [activeTab, setActiveTab] = useState<ContextTab>(null);
  const [saveStatus, setSaveStatus] = useState<'draft' | 'saved'>('draft');
  const [inspirationInputFocused, setInspirationInputFocused] = useState(false);

  const isCompact = terminalWidth > 0 ? terminalWidth < COMPACT_LAYOUT_WIDTH : false;
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
      setSaveStatus('saved');
      setInspirationInputFocused(false);
      setTimeout(() => setSaveStatus('draft'), 2000);
    }
  }, [props]);
  
  // Keyboard handling
  useKeyboard(useCallback((key: { name: string; ctrl: boolean; meta: boolean; preventDefault: () => void }) => {
    // Global hard exit (works even when textarea is focused).
    if (key.ctrl && key.name === 'q') {
      safeExit();
      return;
    }

    // When capture textarea is focused, do not treat global hotkeys.
    if (inspirationInputFocused) {
      // Allow Escape to unfocus input first.
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
    if (key.name === 't') toggleViewMode();
    if (key.name === 's' && props.onSendSnapshot) {
      props.onSendSnapshot();
      return;
    }
  }, [activeTab, inspirationInputFocused, toggleViewMode, props]));
  
  // Derived UI values
  const viewLabel = viewMode === 'flow' ? 'Flow' : 'Tree';
  const completedCount = props.explorations.filter(e => e.status === 'complete').length;
  const interruptionErrorCount = props.explorations.filter(
    e => (e.errorCounts.system + e.errorCounts.result) > 0
  ).length;
  
  const phase = props.tree?.phase.current || 'waiting';
  const icon = props.tree ? phaseIcons[props.tree.phase.current] ?? '⏸' : '⏳';
  const phaseColor = props.tree ? phaseColors[props.tree.phase.current] ?? colors.fg.muted : colors.fg.muted;
  
  const items = props.tree ? treeNodes(props.tree) : [];
  const fa = props.tree?.fileAccess ?? new Map();
  const wikiLinkText = props.wikiMatch ? props.wikiMatch.entry.id : '';

  // Calculate available width for flow body content
  // This ensures accurate textarea height calculations
  const layout = getContextPanelLayout(terminalWidth);
  const flowBodyWidth = activeTab && !layout.isStacked
    ? Math.max(40, terminalWidth - (typeof layout.flexBasis === 'number' ? layout.flexBasis : 40))
    : terminalWidth;

  return (
    <box style={{ width: '100%', height: '100%', flexDirection: 'column', backgroundColor: colors.bg.primary }}>
      {/* Header */}
      <box style={{ 
        width: '100%', 
        backgroundColor: colors.bg.secondary, 
        paddingLeft: 1, 
        paddingRight: 1, 
        flexDirection: 'row', 
        justifyContent: 'space-between' 
      }}>
        <text>
          <span fg={colors.accent.primary}>[{props.runtimeModel}]</span>
          <span fg={colors.fg.dim}>  │ </span>
          <span fg={colors.status.warning}>{props.tokenDisplay}</span>
          <span fg={colors.fg.dim}>  │ </span>
          <span fg={phaseColor}>{icon} {phase}</span>
          <span fg={colors.fg.dim}>  </span>
          <span fg={colors.status.success}>{`Done:${completedCount}`}</span>
          <span fg={colors.fg.dim}>  </span>
          <span fg={interruptionErrorCount > 0 ? colors.status.error : colors.fg.secondary}>
            {`Err:${interruptionErrorCount}`}
          </span>
        </text>
      </box>
      
      {/* Session path status */}
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
      
      {/* Main content area */}
      <box style={{ flexGrow: 1, flexDirection: 'row' }} onMouseDown={blurInspirationInput}>
        {/* Flow/Tree view */}
        <box style={{ 
          flexGrow: 1, 
          flexDirection: 'column', 
          border: !activeTab, // Border only when no panel
          borderColor: colors.border.normal 
        }}
        onMouseDown={blurInspirationInput}>
          <scrollbox style={{ 
            flexGrow: 1, 
            padding: 1, 
            stickyScroll: true, 
            stickyStart: 'bottom', 
            viewportCulling: false 
          }}
          onMouseDown={blurInspirationInput}>
            {viewMode === 'flow' ? (
              <LiveObserverFlowBody
                explorations={props.explorations}
                summaries={props.explorationSummaries}
                wikiPersistStatus={props.explorationPersistStatus}
                pendingSummaryCount={props.pendingSummaryCount}
                directionsStatus={props.directionsStatus}
                directionsMessage={props.directionsMessage}
                potentialDirections={props.potentialDirections}
                availableWidth={flowBodyWidth}
                // Provenance for UI badges
                summarySources={props.summarySources}
                summaryReasons={props.summaryReasons}
                persistResults={props.persistResults}
                cacheStatus={props.cacheStatus}
                cacheReason={props.cacheReason}
              />
            ) : items.length === 0 ? (
              <text fg={colors.fg.muted}>Waiting for Claude activity...</text>
            ) : (
              items.map(({ node, depth, isLast }) => (
                <TreeNode key={node.id} node={node} depth={depth} isLast={isLast} fileAccess={fa} />
              ))
            )}
          </scrollbox>
        </box>
        
        {/* Context Panel (when active) */}
        <ContextPanel
          activeTab={activeTab}
          terminalWidth={terminalWidth}
          inputFocused={inspirationInputFocused}
          onInputFocusChange={setInspirationInputFocused}
          inspirations={props.recentInspirations}
          onSaveInspiration={handleSaveInspiration}
        />
      </box>
      
      {/* File access heatmap */}
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
      
      {/* Command Bar */}
      <CommandBar
        terminalWidth={terminalWidth}
        inspirationInputFocused={inspirationInputFocused}
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
