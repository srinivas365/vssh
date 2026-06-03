import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { TransferEngineName, TransferRecord, TransferStartRequest } from '@shared/types';

interface TransferManagerDeps {
  chooseEngine: (request: TransferStartRequest) => Promise<TransferEngineName>;
  startEngine: (record: TransferRecord) => void | Promise<void>;
}

export class TransferManager extends EventEmitter {
  private readonly records = new Map<string, TransferRecord>();

  constructor(private readonly deps: TransferManagerDeps) {
    super();
  }

  async start(request: TransferStartRequest): Promise<TransferRecord> {
    if (this.hasActiveTransferForVm(request.vmId)) throw new Error('transfer-already-active-for-vm');

    const engine = await this.deps.chooseEngine(request);
    const record: TransferRecord = {
      id: randomUUID(),
      vmId: request.vmId,
      direction: request.direction,
      engine,
      status: 'preparing',
      source: request.source,
      destination: request.destination,
      folderMode: request.folderMode,
      startedAt: Date.now(),
      finishedAt: null,
      transferredBytes: 0,
      totalBytes: null,
      percent: null,
      error: null,
      partialsKept: false,
    };

    this.records.set(record.id, record);
    this.emit('state', record);
    void this.deps.startEngine(record);
    return record;
  }

  get(id: string): TransferRecord | undefined {
    return this.records.get(id);
  }

  list(): TransferRecord[] {
    return Array.from(this.records.values());
  }

  private hasActiveTransferForVm(vmId: number): boolean {
    return this.list().some((record) => record.vmId === vmId && ['preparing', 'running', 'paused'].includes(record.status));
  }
}
