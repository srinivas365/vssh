import { describe, expect, it, vi } from 'vitest';
import { TransferManager } from '../../src/main/transfer/transfer-manager';
import type { TransferRecord, TransferStartRequest } from '../../src/shared/types';

function request(vmId = 1): TransferStartRequest {
  return {
    vmId,
    vmLabel: 'Test VM',
    vmHost: '10.0.0.1',
    direction: 'upload',
    source: { path: '/tmp/a.txt', name: 'a.txt', type: 'file' },
    destination: { directory: '/home/admin', finalPath: '/home/admin/a.txt' },
    folderMode: 'as-is',
    overwrite: true,
  };
}

describe('TransferManager', () => {
  it('creates a preparing transfer record', async () => {
    const manager = new TransferManager({ chooseEngine: async () => 'sftp', startEngine: vi.fn() });
    const record = await manager.start(request());
    expect(record.vmId).toBe(1);
    expect(record.status).toBe('preparing');
    expect(record.engine).toBe('sftp');
  });

  it('blocks two active transfers for the same VM', async () => {
    const manager = new TransferManager({ chooseEngine: async () => 'sftp', startEngine: vi.fn() });
    await manager.start(request(7));
    await expect(manager.start(request(7))).rejects.toThrow('transfer-already-active-for-vm');
  });

  it('allows concurrent transfers for different VMs', async () => {
    const manager = new TransferManager({ chooseEngine: async () => 'sftp', startEngine: vi.fn() });
    await manager.start(request(1));
    await expect(manager.start(request(2))).resolves.toMatchObject({ vmId: 2 });
  });

  it('preserves transferredBytes in state event after progress applied', async () => {
    const stateEvents: TransferRecord[] = [];
    const manager = new TransferManager({ chooseEngine: async () => 'sftp', startEngine: vi.fn() });
    manager.on('state', (r: TransferRecord) => stateEvents.push(r));

    const record = await manager.start(request());
    manager.applyProgress({ id: record.id, transferredBytes: 1024, totalBytes: 2048, percent: 50 });
    manager.updateStatus(record.id, 'succeeded');

    const finalState = stateEvents[stateEvents.length - 1];
    expect(finalState.transferredBytes).toBe(1024);
    expect(finalState.percent).toBe(50);
  });

  it('sets partialsKept to false when transfer fails', async () => {
    const stateEvents: TransferRecord[] = [];
    const manager = new TransferManager({ chooseEngine: async () => 'sftp', startEngine: vi.fn() });
    manager.on('state', (r: TransferRecord) => stateEvents.push(r));

    const record = await manager.start(request());
    manager.fail(record.id, 'connection lost');

    const finalState = stateEvents[stateEvents.length - 1];
    expect(finalState.partialsKept).toBe(false);
    expect(finalState.status).toBe('failed');
  });
});
