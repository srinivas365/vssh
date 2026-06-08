import { describe, expect, it } from 'vitest';
import { buildCloneInput, nextCloneLabel } from '../../src/shared/vm-clone';
import type { Vm } from '../../src/shared/types';

const baseVm: Vm = {
  id: 1,
  folderId: 2,
  label: 'web-01',
  host: '10.0.0.5',
  port: 22,
  username: 'admin',
  authMethod: 'password',
  keyPath: null,
  vaultRef: 'ref',
  autoCopyDisabled: false,
  autoSubmitEnabled: true,
  lastUsedAt: null,
  createdAt: 0,
};

describe('nextCloneLabel', () => {
  it('increments numeric suffixes', () => {
    expect(nextCloneLabel('web-01')).toBe('web-02');
    expect(nextCloneLabel('prod-db-9')).toBe('prod-db-10');
  });

  it('appends copy when no numeric suffix', () => {
    expect(nextCloneLabel('staging')).toBe('staging copy');
    expect(nextCloneLabel('staging copy')).toBe('staging copy 2');
  });
});

describe('buildCloneInput', () => {
  it('copies settings and keeps the host unchanged', () => {
    expect(buildCloneInput(baseVm)).toEqual({
      folderId: 2,
      label: 'web-02',
      host: '10.0.0.5',
      port: 22,
      username: 'admin',
      authMethod: 'password',
      keyPath: null,
      autoSubmitEnabled: true,
    });
  });
});
