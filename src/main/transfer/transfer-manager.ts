import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { TransferEngineName, TransferProgressEvent, TransferRecord, TransferStartRequest, TransferStatus } from '@shared/types';

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
      vmLabel: request.vmLabel,
      vmHost: request.vmHost,
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

  updateStatus(id: string, status: TransferStatus): void {
    const record = this.records.get(id);
    if (!record) return;
    const updated = { ...record, status, finishedAt: ['succeeded', 'failed', 'stopped'].includes(status) ? Date.now() : record.finishedAt };
    this.records.set(id, updated);
    this.emit('state', updated);
  }

  fail(id: string, error: string): void {
    const record = this.records.get(id);
    if (!record) return;
    const updated = { ...record, status: 'failed' as const, error, partialsKept: false, finishedAt: Date.now() };
    this.records.set(id, updated);
    this.emit('state', updated);
    this.emit('toast', { id, vmId: updated.vmId, status: updated.status, message: error, canResume: false, canDeletePartials: false });
  }

  pause(id: string): void {
    this.updateStatus(id, 'paused');
    this.markPartials(id, true);
    this.emit('engine-pause', id);
  }

  resume(id: string): void {
    const record = this.records.get(id);
    if (record) void this.deps.startEngine(record);
  }

  stop(id: string): void {
    this.markPartials(id, false);
    this.updateStatus(id, 'stopped');
    this.emit('engine-stop', id);
  }

  deletePartials(id: string): void {
    this.markPartials(id, false);
    this.emit('delete-partials', id);
  }

  applyProgress(event: TransferProgressEvent): void {
    const record = this.records.get(event.id);
    if (!record) return;
    const updated = { ...record, transferredBytes: event.transferredBytes, totalBytes: event.totalBytes, percent: event.percent };
    this.records.set(event.id, updated);
  }

  private markPartials(id: string, partialsKept: boolean): void {
    const record = this.records.get(id);
    if (!record) return;
    const updated = { ...record, partialsKept };
    this.records.set(id, updated);
    this.emit('state', updated);
  }

  private hasActiveTransferForVm(vmId: number): boolean {
    return this.list().some((record) => record.vmId === vmId && ['preparing', 'running', 'paused'].includes(record.status));
  }
}
