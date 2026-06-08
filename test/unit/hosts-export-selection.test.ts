import { describe, expect, it } from 'vitest';
import {
  countExportHosts,
  defaultExportSelection,
  workspaceHostCounts,
} from '../../src/shared/hosts-export-selection';
import type { Folder, Vm } from '../../src/shared/types';

const folders: Folder[] = [
  { id: 1, name: 'Production', parentId: null, sortOrder: 0 },
  { id: 2, name: 'Staging', parentId: null, sortOrder: 1 },
];

const vms: Vm[] = [
  {
    id: 1, folderId: 1, label: 'a', host: '1', port: 22, username: 'u', authMethod: 'password',
    keyPath: null, vaultRef: 'r1', autoCopyDisabled: false, autoSubmitEnabled: true, lastUsedAt: null, createdAt: 0,
  },
  {
    id: 2, folderId: 2, label: 'b', host: '2', port: 22, username: 'u', authMethod: 'password',
    keyPath: null, vaultRef: 'r2', autoCopyDisabled: false, autoSubmitEnabled: true, lastUsedAt: null, createdAt: 0,
  },
  {
    id: 3, folderId: null, label: 'c', host: '3', port: 22, username: 'u', authMethod: 'password',
    keyPath: null, vaultRef: 'r3', autoCopyDisabled: false, autoSubmitEnabled: true, lastUsedAt: null, createdAt: 0,
  },
];

describe('hosts export selection', () => {
  it('selects all workspaces and unassigned by default', () => {
    expect(defaultExportSelection(folders, vms)).toEqual({
      folderIds: [1, 2],
      includeUnassigned: true,
    });
    expect(countExportHosts(vms, defaultExportSelection(folders, vms))).toBe(3);
  });

  it('counts hosts per workspace', () => {
    const counts = workspaceHostCounts(folders, vms);
    expect(counts.get(1)).toBe(1);
    expect(counts.get(2)).toBe(1);
    expect(counts.get(null)).toBe(1);
  });

  it('filters export hosts by selected workspaces', () => {
    expect(countExportHosts(vms, { folderIds: [1], includeUnassigned: false })).toBe(1);
    expect(countExportHosts(vms, { folderIds: [2], includeUnassigned: true })).toBe(2);
  });
});
