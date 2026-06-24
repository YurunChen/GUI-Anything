import { describe, expect, it } from 'bun:test';
import type { EvolutionNode } from '../../data/protocol/evolution-types';
import {
  computePersonaAxes,
  ruleBasedPersona,
  signalsFromNodes,
  typeCodeFromAxes,
  type PersonaSignals,
} from './persona-score';

function node(id: string, partial: Partial<EvolutionNode> = {}): EvolutionNode {
  return {
    id,
    eraId: 'e1',
    sessionId: 's1',
    title: id,
    note: '',
    at: 0,
    delta: 'continue',
    children: [],
    ...partial,
  } as EvolutionNode;
}

describe('computePersonaAxes', () => {
  it('produces four clamped 0–100 axes', () => {
    const axes = computePersonaAxes({
      milestoneCount: 4,
      substepCount: 4,
      sessionCount: 2,
      toolCount: 20,
      errorCount: 2,
      retrievals: 3,
      writes: 1,
    });
    expect(axes).toHaveLength(4);
    for (const a of axes) {
      expect(a.value).toBeGreaterThanOrEqual(0);
      expect(a.value).toBeLessThanOrEqual(100);
    }
    // milestoneCount == substepCount ⇒ divergent == 50
    expect(axes[0].value).toBe(50);
  });

  it('leans tinkerer when error density is high', () => {
    const planner = computePersonaAxes({
      milestoneCount: 2, substepCount: 0, sessionCount: 1,
      toolCount: 100, errorCount: 0, retrievals: 0, writes: 0,
    });
    const tinkerer = computePersonaAxes({
      milestoneCount: 2, substepCount: 0, sessionCount: 1,
      toolCount: 100, errorCount: 40, retrievals: 0, writes: 0,
    });
    expect(planner[1].value).toBeLessThan(tinkerer[1].value);
    expect(tinkerer[1].value).toBe(100); // 0.4 * 250 == 100
  });

  it('defaults knowledge axis to 50 when there is no knowledge signal', () => {
    const axes = computePersonaAxes({
      milestoneCount: 1, substepCount: 0, sessionCount: 1,
      toolCount: 0, errorCount: 0, retrievals: 0, writes: 0,
    });
    expect(axes[2].value).toBe(50);
  });
});

describe('typeCodeFromAxes', () => {
  it('picks the right pole code when value >= 50, else the left', () => {
    const signals: PersonaSignals = {
      milestoneCount: 1, substepCount: 9, sessionCount: 1,
      toolCount: 10, errorCount: 0, retrievals: 0, writes: 10,
    };
    const axes = computePersonaAxes(signals);
    const code = typeCodeFromAxes(axes);
    expect(code).toMatch(/^[FD][PT][OR][ES]$/);
    // mostly substeps ⇒ focused (left, F); no errors ⇒ planner (left, P)
    expect(code[0]).toBe('F');
    expect(code[1]).toBe('P');
  });
});

describe('signalsFromNodes', () => {
  it('rolls up substeps and per-node metrics', () => {
    const nodes: EvolutionNode[] = [
      node('s1:a', {
        children: [{ title: 'x', at: 1, delta: 'continue' }],
        metrics: { toolCount: 5, errorCount: 1, retrievals: 2, writes: 1, interrupted: 0 },
      }),
      node('s1:b', {
        metrics: { toolCount: 3, errorCount: 0, retrievals: 0, writes: 2, interrupted: 0 },
      }),
    ];
    const s = signalsFromNodes(nodes, 2);
    expect(s.milestoneCount).toBe(2);
    expect(s.substepCount).toBe(1);
    expect(s.toolCount).toBe(8);
    expect(s.errorCount).toBe(1);
    expect(s.retrievals).toBe(2);
    expect(s.writes).toBe(3);
    expect(s.sessionCount).toBe(2);
  });
});

describe('ruleBasedPersona', () => {
  it('returns a complete deterministic persona with a 4-letter type code', () => {
    const nodes: EvolutionNode[] = [
      node('s1:a', { metrics: { toolCount: 12, errorCount: 4, retrievals: 1, writes: 0, interrupted: 0 } }),
      node('s1:b', { metrics: { toolCount: 3, errorCount: 0, retrievals: 0, writes: 1, interrupted: 0 } }),
    ];
    const p = ruleBasedPersona(nodes, 1);
    expect(p.typeCode).toHaveLength(4);
    expect(p.scores).toHaveLength(4);
    expect(p.title.length).toBeGreaterThan(0);
    expect(p.tagline).toContain(p.typeCode);
    expect(p.reading.length).toBeGreaterThan(0);
    // signature node = highest toolCount
    expect(p.signatureNodeId).toBe('s1:a');
  });
});
