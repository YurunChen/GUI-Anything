import { describe, expect, it } from 'bun:test';
import type { EvolutionNode } from '../../data/protocol/evolution-types';
import {
  computePersonaAxes,
  isArchetypeSignalReady,
  isRarityEvidenceReady,
  matchArchetype,
  ruleBasedPersona,
  signalsFromNodes,
  typeCodeFromAxes,
  type PersonaSignals,
} from './persona-score';

const NOON = new Date(2026, 0, 1, 12, 0, 0).getTime(); // fixed daytime, avoids night classification

function node(id: string, partial: Partial<EvolutionNode> = {}): EvolutionNode {
  return {
    id,
    eraId: 'e1',
    sessionId: 's1',
    title: id,
    note: '',
    at: NOON,
    delta: 'continue',
    children: [],
    ...partial,
  } as EvolutionNode;
}

function signals(partial: Partial<PersonaSignals> = {}): PersonaSignals {
  return {
    milestoneCount: 1, substepCount: 0, sessionCount: 1,
    toolCount: 0, errorCount: 0, retrievals: 0, writes: 0,
    nightShare: 0, pivotShare: 0, interruptedShare: 0, intensity: 0,
    ...partial,
  };
}

describe('computePersonaAxes', () => {
  it('produces six clamped 0–100 axes', () => {
    const axes = computePersonaAxes(signals({ milestoneCount: 4, substepCount: 4, toolCount: 20, errorCount: 2, retrievals: 3, writes: 1 }));
    expect(axes).toHaveLength(6);
    for (const a of axes) {
      expect(a.value).toBeGreaterThanOrEqual(0);
      expect(a.value).toBeLessThanOrEqual(100);
    }
    expect(axes[0].value).toBe(50); // milestoneCount == substepCount ⇒ divergent == 50
  });

  it('leans tinkerer when error density is high', () => {
    const planner = computePersonaAxes(signals({ milestoneCount: 2, toolCount: 100, errorCount: 0 }));
    const tinkerer = computePersonaAxes(signals({ milestoneCount: 2, toolCount: 100, errorCount: 40 }));
    expect(planner[1].value).toBeLessThan(tinkerer[1].value);
    expect(tinkerer[1].value).toBe(100); // 0.4 * 250 == 100
  });

  it('defaults knowledge axis to 50 when there is no knowledge signal', () => {
    expect(computePersonaAxes(signals())[2].value).toBe(50);
  });

  it('maps night and pivot shares onto axes 4 and 5', () => {
    const axes = computePersonaAxes(signals({ nightShare: 0.8, pivotShare: 0.6 }));
    expect(axes[4].value).toBe(80);
    expect(axes[5].value).toBe(60);
  });
});

describe('typeCodeFromAxes', () => {
  it('picks the right pole code when value >= 50, else the left', () => {
    const axes = computePersonaAxes(signals({ substepCount: 9, toolCount: 10, writes: 10 }));
    const code = typeCodeFromAxes(axes);
    expect(code).toMatch(/^[FD][PT][OR][ES][UN][KV]$/);
    expect(code[0]).toBe('F'); // mostly substeps ⇒ focused
    expect(code[1]).toBe('P'); // no errors ⇒ planner
  });
});

describe('signalsFromNodes', () => {
  it('rolls up substeps, metrics, night and pivot shares', () => {
    const nodes: EvolutionNode[] = [
      node('s1:a', {
        delta: 'pivot',
        children: [{ title: 'x', at: 1, delta: 'continue' }],
        metrics: { toolCount: 5, errorCount: 1, retrievals: 2, writes: 1, interrupted: 0 },
      }),
      node('s1:b', { metrics: { toolCount: 3, errorCount: 0, retrievals: 0, writes: 2, interrupted: 0 } }),
    ];
    const s = signalsFromNodes(nodes, 2);
    expect(s.milestoneCount).toBe(2);
    expect(s.substepCount).toBe(1);
    expect(s.toolCount).toBe(8);
    expect(s.writes).toBe(3);
    expect(s.pivotShare).toBe(0.5); // one of two nodes is a pivot
    expect(s.nightShare).toBe(0); // both at noon
  });
});

describe('matchArchetype', () => {
  it('matches a focused high-delivery profile to a delivery-oriented archetype', () => {
    const input = signals({ milestoneCount: 4, substepCount: 12, toolCount: 40, errorCount: 1, writes: 12 });
    const axes = computePersonaAxes(input);
    const m = matchArchetype(axes, input);
    expect(['ARCH', 'SHIP', 'STEADY', 'MARATHON']).toContain(m.code);
    expect(m.spectrum.length).toBe(3);
  });

  it('VOID egg fires when nothing was deposited', () => {
    const input = signals({ milestoneCount: 3, writes: 0 });
    const axes = computePersonaAxes(input);
    const m = matchArchetype(axes, input);
    expect(m.code).toBe('VOID');
  });

  it('VOID egg does not fire from the first empty milestone', () => {
    const input = signals({ milestoneCount: 1, writes: 0 });
    const axes = computePersonaAxes(input);
    const m = matchArchetype(axes, input);
    expect(m.code).not.toBe('VOID');
  });

  it('OWL egg fires for night owls', () => {
    const input = signals({ milestoneCount: 4, writes: 3, nightShare: 0.7 });
    const axes = computePersonaAxes(input);
    const m = matchArchetype(axes, input);
    expect(m.code).toBe('OWL');
  });

  it('does not award legendary archetypes from a single saved milestone', () => {
    const input = signals({ milestoneCount: 1, toolCount: 4, writes: 1 });
    const axes = computePersonaAxes(input);
    const m = matchArchetype(axes, input);
    expect(m.code).not.toBe('STAR');
    expect(m.spectrum.map((item) => item.code)).not.toContain('STAR');
  });
});

describe('isRarityEvidenceReady', () => {
  it('gates rarer personalities behind progressively stronger evidence', () => {
    expect(isRarityEvidenceReady('common', { nightShare: 0, interruptedShare: 0, writes: 0, milestoneCount: 1 })).toBe(true);
    expect(isRarityEvidenceReady('uncommon', { nightShare: 0, interruptedShare: 0, writes: 0, milestoneCount: 2 })).toBe(false);
    expect(isRarityEvidenceReady('uncommon', { nightShare: 0, interruptedShare: 0, writes: 1, milestoneCount: 2 })).toBe(true);
    expect(isRarityEvidenceReady('rare', { nightShare: 0, interruptedShare: 0, writes: 1, milestoneCount: 2 })).toBe(false);
    expect(isRarityEvidenceReady('rare', { nightShare: 0, interruptedShare: 0, writes: 1, milestoneCount: 3 })).toBe(true);
    expect(isRarityEvidenceReady('epic', { nightShare: 0, interruptedShare: 0, writes: 1, milestoneCount: 4 })).toBe(false);
    expect(isRarityEvidenceReady('epic', { nightShare: 0, interruptedShare: 0, writes: 2, milestoneCount: 4 })).toBe(true);
    expect(isRarityEvidenceReady('legendary', { nightShare: 0, interruptedShare: 0, writes: 2, milestoneCount: 6 })).toBe(false);
    expect(isRarityEvidenceReady('legendary', { nightShare: 0, interruptedShare: 0, writes: 3, milestoneCount: 6 })).toBe(true);
  });
});

describe('isArchetypeSignalReady', () => {
  it('requires night evidence for night-oriented personalities', () => {
    expect(isArchetypeSignalReady('NIGHT', signals({ milestoneCount: 4, writes: 1, nightShare: 0.1 }))).toBe(false);
    expect(isArchetypeSignalReady('NIGHT', signals({ milestoneCount: 4, writes: 1, nightShare: 0.3 }))).toBe(true);
  });

  it('requires error evidence for fire and tinkering personalities', () => {
    expect(isArchetypeSignalReady('FIRE', signals({ milestoneCount: 2, writes: 1, toolCount: 20, errorCount: 0 }))).toBe(false);
    expect(isArchetypeSignalReady('FIRE', signals({ milestoneCount: 2, writes: 1, toolCount: 20, errorCount: 1 }))).toBe(true);
    expect(isArchetypeSignalReady('TINKER', signals({ milestoneCount: 1, toolCount: 20, errorCount: 1 }))).toBe(false);
    expect(isArchetypeSignalReady('TINKER', signals({ milestoneCount: 1, toolCount: 20, errorCount: 3 }))).toBe(true);
  });

  it('requires route-change evidence for pivot personalities', () => {
    expect(isArchetypeSignalReady('PIVOT', signals({ milestoneCount: 3, writes: 1, pivotShare: 0.1 }))).toBe(false);
    expect(isArchetypeSignalReady('PIVOT', signals({ milestoneCount: 3, writes: 1, pivotShare: 0.3 }))).toBe(true);
  });

  it('requires retrieval evidence for reuse personalities', () => {
    expect(isArchetypeSignalReady('REUSE', signals({ milestoneCount: 2, writes: 1, retrievals: 0 }))).toBe(false);
    expect(isArchetypeSignalReady('REUSE', signals({ milestoneCount: 2, writes: 1, retrievals: 1 }))).toBe(true);
  });
});

describe('ruleBasedPersona', () => {
  it('returns a complete deterministic persona with a 6-letter type code and archetype', () => {
    const nodes: EvolutionNode[] = [
      node('s1:a', { metrics: { toolCount: 12, errorCount: 4, retrievals: 1, writes: 0, interrupted: 0 } }),
      node('s1:b', { metrics: { toolCount: 3, errorCount: 0, retrievals: 0, writes: 1, interrupted: 0 } }),
    ];
    const p = ruleBasedPersona(nodes, 1);
    expect(p.typeCode).toHaveLength(6);
    expect(p.scores).toHaveLength(6);
    expect(p.archetypeCode && p.archetypeCode.length).toBeGreaterThan(0);
    expect(p.cnName && p.cnName.length).toBeGreaterThan(0);
    expect(p.dna).toContain('·');
    expect(p.reading.length).toBeGreaterThan(0);
    expect(p.signatureNodeId).toBe('s1:a'); // highest toolCount
  });
});
