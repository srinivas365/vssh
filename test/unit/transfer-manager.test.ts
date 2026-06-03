import { describe, expect, it, vi } from 'vitest';
import { TransferManager } from '../../src/main/transfer/transfer-manager';
import type { TransferStartRequest } from '../../src/shared/types';

function request(vmId = 1): TransferStartRequest {
  return {
    vmId,
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
});
