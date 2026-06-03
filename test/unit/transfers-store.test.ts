import { describe, expect, it } from 'vitest';
import { createTransfersStore } from '../../src/renderer/state/transfers-store';
import type { TransferRecord } from '../../src/shared/types';

function record(id: string, status: TransferRecord['status']): TransferRecord {
  return {
    id,
    vmId: 1,
    vmLabel: 'Test VM',
    vmHost: '10.0.0.1',
    direction: 'upload',
    engine: 'sftp',
    status,
    source: { path: '/tmp/a.txt', name: 'a.txt', type: 'file' },
    destination: { directory: '/home/admin', finalPath: '/home/admin/a.txt' },
    folderMode: 'as-is',
    startedAt: 1,
    finishedAt: null,
    transferredBytes: 0,
    totalBytes: null,
    percent: null,
    error: null,
    partialsKept: false,
  };
}

describe('transfers store', () => {
  it('upserts transfer records', () => {
    const store = createTransfersStore();
    store.getState().upsert(record('a', 'running'));
    store.getState().upsert(record('a', 'succeeded'));
    expect(store.getState().transfers).toHaveLength(1);
    expect(store.getState().transfers[0].status).toBe('succeeded');
  });

  it('applies progress events', () => {
    const store = createTransfersStore();
    store.getState().upsert(record('a', 'running'));
    store.getState().applyProgress({ id: 'a', transferredBytes: 50, totalBytes: 100, percent: 50 });
    expect(store.getState().transfers[0].percent).toBe(50);
  });
});
