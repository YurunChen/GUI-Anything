import { describe, expect, it } from 'bun:test';
import type { TreeDataNode } from './TreeView';
import {
  isLinearChain,
  measureGridLevelOuterWidth,
  resolveCardInnerWidth,
  resolveCenterPadding,
  resolveFlowGraphLayoutMode,
  resolveStackCardInnerWidth,
  shouldTruncateNodeLabel,
} from './flow-graph-layout';

function level(count: number): TreeDataNode[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `n_${i}`,
    text: `node ${i}`,
    children: [],
  }));
}

describe('flow graph layout', () => {
  it('detects linear chains', () => {
    expect(isLinearChain([level(1), level(1), level(1)])).toBe(true);
    expect(isLinearChain([level(1), level(2)])).toBe(false);
  });

  it('uses full width for single-node levels', () => {
    expect(resolveCardInnerWidth(80, 1)).toBe(76);
    expect(resolveCardInnerWidth(40, 1)).toBe(36);
  });

  it('splits width across siblings in grid mode', () => {
    expect(resolveCardInnerWidth(80, 2)).toBe(35);
    expect(resolveCardInnerWidth(80, 4)).toBe(14);
  });

  it('prefers stack layout for linear chains in typical panes', () => {
    const linear = [level(1), level(1)];
    expect(resolveFlowGraphLayoutMode(60, linear)).toBe('rail');
    expect(resolveFlowGraphLayoutMode(90, linear)).toBe('stack');
    expect(resolveFlowGraphLayoutMode(140, linear)).toBe('stack');
  });

  it('uses grid layout for branching graphs when wide enough', () => {
    const branching = [level(1), level(3)];
    expect(resolveFlowGraphLayoutMode(120, branching)).toBe('grid');
    expect(resolveFlowGraphLayoutMode(60, branching)).toBe('rail');
  });

  it('only truncates labels when card inner width is tight', () => {
    expect(shouldTruncateNodeLabel(19)).toBe(true);
    expect(shouldTruncateNodeLabel(24)).toBe(false);
  });

  it('centers grid level with symmetric padding', () => {
    const content = measureGridLevelOuterWidth(100, 2);
    expect(resolveCenterPadding(100, content)).toBe(Math.floor((100 - content) / 2));
  });

  it('uses full pane width for stack column', () => {
    expect(resolveStackCardInnerWidth(120)).toBe(116);
    expect(resolveStackCardInnerWidth(40)).toBe(36);
  });
});
