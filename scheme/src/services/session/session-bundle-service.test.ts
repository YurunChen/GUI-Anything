import { describe, expect, it } from 'bun:test';
import { defaultSessionBundleRepository } from '../../data/wiki/session-bundle-repository';
import { getSessionBundleRepository, getSessionBundleService } from './session-bundle-service';

describe('SessionBundleService', () => {
  it('getSessionBundleRepository returns the same instance as defaultSessionBundleRepository', () => {
    expect(getSessionBundleRepository()).toBe(defaultSessionBundleRepository());
    expect(getSessionBundleService().getRepository()).toBe(defaultSessionBundleRepository());
  });
});
