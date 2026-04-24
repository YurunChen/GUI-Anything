import { createCliRenderer } from '@opentui/core';
import { createRoot } from '@opentui/react';
import type { ReactNode } from 'react';
import { useState, useCallback } from 'react';
import { useKeyboard } from '@opentui/react';
import type { ActivityTree } from '../../core/types';
import { treeNodes, TreeNode } from './tree-node';
import { FlowView } from './flow-view';
import { colors, phaseIcons, phaseColors } from './theme';

export function PostHocView({ tree, prompt, sessionPath }: {
  tree: ActivityTree;
  prompt: string;
  sessionPath: string;
}): ReactNode {
  const [viewMode, setViewMode] = useState<'flow' | 'tree'>('flow');
  const items = treeNodes(tree);
  const fa = tree.fileAccess ?? new Map();
  const viewLabel = viewMode === 'flow' ? 'Flow' : 'Tree';
  const modeColor = viewMode === 'flow' ? colors.accent.primary : colors.accent.secondary;

  useKeyboard(useCallback((key: { name: string }) => {
    if (key.name === 'q' || key.name === 'escape') process.exit(0);
    if (key.name === 't') setViewMode(prev => prev === 'flow' ? 'tree' : 'flow');
  }, []));

  return (
    <box style={{ width: '100%', height: '100%', flexDirection: 'column', backgroundColor: colors.bg.primary }}>
      {/* Title bar */}
      <box style={{ width: '100%', paddingLeft: 2, paddingRight: 2, flexDirection: 'row', backgroundColor: colors.bg.secondary }}>
        <text fg={colors.status.success} bold={true}> {'✓ Complete'} </text>
        <spacer />
        <text fg={modeColor} bold={true}> [{viewLabel}]</text>
      </box>

      {/* Info bar */}
      <box style={{ width: '100%', paddingLeft: 2, flexDirection: 'row', backgroundColor: colors.bg.tertiary }}>
        <text fg={colors.fg.dim}>
          <span fg={colors.accent.primary}>{prompt.slice(0, 60)}{prompt.length > 60 ? '…' : ''}</span>
          <span fg={colors.fg.dim}> │ </span>
          <span>{sessionPath.split('/').slice(-2).join('/')}</span>
          {viewMode === 'tree' && (
            <>
              <span fg={colors.fg.dim}> │ </span>
              <span fg={colors.fg.secondary}>{`${tree.nodes.size}n ${tree.stats.toolCallCount}t`}</span>
            </>
          )}
        </text>
      </box>

      {/* Main panel */}
      <box style={{ flexGrow: 1, flexDirection: 'column', border: true, borderColor: colors.border.normal }}>
        <scrollbox style={{ flexGrow: 1, paddingX: 1 }}>
          {items.length === 0 ? (
            <text fg={colors.fg.dim}>No activity found in this session</text>
          ) : viewMode === 'flow' ? (
            <FlowView tree={tree} running={false} elapsed={0} />
          ) : (
            items.map(({ node, depth, isLast }) => (
              <TreeNode key={node.id} node={node} depth={depth} isLast={isLast} fileAccess={fa} />
            ))
          )}
        </scrollbox>
      </box>

      {/* File access footer */}
      {tree.fileAccess.size > 0 && (
        <box style={{ width: '100%', backgroundColor: colors.bg.tertiary, paddingLeft: 2, paddingRight: 2, flexDirection: 'row' }}>
          <text fg={colors.fg.muted}>
            {[...tree.fileAccess.entries()]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([path, count]) => {
                const short = path.includes('/') ? path.split('/').pop()! : path;
                const warn = count >= 3 ? ' ⚠' : '';
                return `${short}: ${count}${warn}`;
              })
              .join('  ·  ')}
          </text>
        </box>
      )}

      {/* Footer */}
      <box style={{ width: '100%', paddingLeft: 2, paddingRight: 2, flexDirection: 'row', backgroundColor: colors.bg.secondary }}>
        <text fg={colors.fg.dim}>
          <span fg={colors.fg.muted}>t:</span> toggle {viewMode === 'flow' ? 'tree' : 'flow'}{' '}
          <span fg={colors.fg.muted}>q:</span> quit
        </text>
      </box>
    </box>
  );
}

export async function renderPostHoc(tree: ActivityTree, prompt: string, sessionPath: string): Promise<void> {
  const renderer = await createCliRenderer({ exitOnCtrlC: true });
  const root = createRoot(renderer);
  root.render(<PostHocView tree={tree} prompt={prompt} sessionPath={sessionPath} />);
}
