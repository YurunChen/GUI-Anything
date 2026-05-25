import { describe, expect, it } from 'bun:test';
import {
  allocateId,
  facetFromPersistType,
  normalizeStorageType,
  parseStorageType,
} from './knowledge-normalize';

describe('knowledge-normalize', () => {
  it('maps engineering persist types to context', () => {
    expect(normalizeStorageType('error')).toBe('context');
    expect(normalizeStorageType('snippet')).toBe('context');
    expect(normalizeStorageType('decision')).toBe('context');
    expect(normalizeStorageType('entity')).toBe('entity');
  });

  it('maps facets from persist types', () => {
    expect(facetFromPersistType('error')).toBe('failure');
    expect(facetFromPersistType('snippet')).toBe('command');
    expect(facetFromPersistType('decision')).toBe('protocol');
  });

  it('parses on-disk yaml types', () => {
    expect(parseStorageType('context')).toBe('context');
    expect(parseStorageType('entity')).toBe('entity');
    expect(parseStorageType('summary')).toBe('summary');
    expect(parseStorageType('decision')).toBe('context');
  });

  it('returns null for unknown persist types', () => {
    expect(normalizeStorageType('bogus' as never)).toBeNull();
  });

  it('allocates C, N, and S ids', () => {
    expect(allocateId('context', ['C001', 'N001'])).toBe('C002');
    expect(allocateId('entity', ['C001', 'N001'])).toBe('N002');
    expect(allocateId('summary', ['S001', 'C001'])).toBe('S002');
  });
});
