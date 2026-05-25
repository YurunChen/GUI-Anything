import { describe, expect, it } from 'bun:test';
import { applyKnowledgeDatesToYaml, formatKnowledgeDates } from './knowledge-dates';

describe('knowledge-dates', () => {
  it('formats ISO timestamps', () => {
    const d = formatKnowledgeDates(new Date('2026-05-25T08:30:00.000Z'));
    expect(d.created).toBe('2026-05-25T08:30:00.000Z');
    expect(d.updated).toBe('2026-05-25T08:30:00.000Z');
  });

  it('backfills dates on update for legacy yaml', () => {
    const yaml = applyKnowledgeDatesToYaml(
      'id: "C001"\nrequest: "q"\nversion: 1',
      'update',
      new Date('2026-05-26T10:00:00.000Z'),
    );
    expect(yaml).toContain('created: "2026-05-26T10:00:00.000Z"');
    expect(yaml).toContain('updated: "2026-05-26T10:00:00.000Z"');
    expect(yaml).not.toContain('date_created');
    expect(yaml).not.toContain('date_updated');
  });

  it('preserves original created on update', () => {
    const yaml = applyKnowledgeDatesToYaml(
      'id: "C001"\ncreated: "2026-01-01T00:00:00.000Z"',
      'update',
      new Date('2026-05-26T10:00:00.000Z'),
    );
    expect(yaml).toContain('created: "2026-01-01T00:00:00.000Z"');
    expect(yaml).toContain('updated: "2026-05-26T10:00:00.000Z"');
  });
});
