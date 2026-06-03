import fs from 'node:fs';
import path from 'node:path';
import type { TransferProgressEvent, TransferRecord, Vm, VaultEntry } from '@shared/types';
import { connectSftp } from './sftp-client';

export interface EngineContext {
  vm: Vm;
  secret: VaultEntry | null;
  emitProgress: (event: TransferProgressEvent) => void;
  emitLog: (line: string, level?: 'info' | 'warn' | 'error') => void;
  markRunning: () => void;
  markSucceeded: () => void;
  markFailed: (error: string, partialsKept: boolean) => void;
}

export class SftpTransferEngine {
  async start(record: TransferRecord, context: EngineContext): Promise<void> {
    context.markRunning();
    context.emitLog('Starting SFTP transfer');
    const conn = await connectSftp(context.vm, context.secret);
    try {
      if (record.direction === 'upload') {
        await this.uploadFile(record, context, conn.sftp);
      } else {
        await this.downloadFile(record, context, conn.sftp);
      }
      context.markSucceeded();
    } catch (err) {
      context.markFailed(err instanceof Error ? err.message : String(err), true);
    } finally {
      conn.close();
    }
  }

  private uploadFile(record: TransferRecord, context: EngineContext, sftp: import('ssh2').SFTPWrapper): Promise<void> {
    return new Promise((resolve, reject) => {
      const total = fs.statSync(record.source.path).size;
      let transferred = 0;
      const read = fs.createReadStream(record.source.path);
      const write = sftp.createWriteStream(record.destination.finalPath, { flags: record.partialsKept ? 'a' : 'w' });
      read.on('data', (chunk) => {
        transferred += chunk.length;
        context.emitProgress({ id: record.id, transferredBytes: transferred, totalBytes: total, percent: Math.min(100, (transferred / total) * 100) });
      });
      read.once('error', reject);
      write.once('error', reject);
      write.once('close', resolve);
      read.pipe(write);
    });
  }

  private downloadFile(record: TransferRecord, context: EngineContext, sftp: import('ssh2').SFTPWrapper): Promise<void> {
    return new Promise((resolve, reject) => {
      let transferred = 0;
      const read = sftp.createReadStream(record.source.path);
      fs.mkdirSync(path.dirname(record.destination.finalPath), { recursive: true });
      const write = fs.createWriteStream(record.destination.finalPath, { flags: record.partialsKept ? 'a' : 'w' });
      read.on('data', (chunk: Buffer) => {
        transferred += chunk.length;
        context.emitProgress({ id: record.id, transferredBytes: transferred, totalBytes: null, percent: null });
      });
      read.once('error', reject);
      write.once('error', reject);
      write.once('close', resolve);
      read.pipe(write);
    });
  }
}
