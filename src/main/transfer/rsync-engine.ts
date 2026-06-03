import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';
import type { TransferProgressEvent, TransferRecord, Vm } from '@shared/types';
import { shouldCopyContentsOnly } from './path-utils';

export interface RsyncContext {
  vm: Vm;
  emitProgress: (event: TransferProgressEvent) => void;
  emitLog: (line: string, level?: 'info' | 'warn' | 'error') => void;
  markRunning: () => void;
  markSucceeded: () => void;
  markFailed: (error: string) => void;
}

export class RsyncTransferEngine {
  private children = new Map<string, ChildProcessWithoutNullStreams>();

  start(record: TransferRecord, context: RsyncContext): void {
    context.markRunning();
    const args = this.buildArgs(record, context.vm);
    context.emitLog(`rsync ${args.join(' ')}`);
    const child = spawn('rsync', args);
    this.children.set(record.id, child);

    child.stdout.on('data', (chunk) => this.handleOutput(record.id, String(chunk), context));
    child.stderr.on('data', (chunk) => context.emitLog(String(chunk), 'warn'));
    child.once('error', (err) => context.markFailed(err.message));
    child.once('exit', (code) => {
      this.children.delete(record.id);
      if (code === 0) context.markSucceeded();
      else context.markFailed(`rsync exited with code ${code}`);
    });
  }

  stop(id: string): void {
    this.children.get(id)?.kill('SIGTERM');
  }

  private buildArgs(record: TransferRecord, vm: Vm): string[] {
    const ssh = ['ssh', '-p', String(vm.port)];
    if (vm.keyPath) ssh.push('-i', vm.keyPath);
    const args = ['-az', '--partial', '--progress', '-e', ssh.join(' ')];
    const sourceSuffix = shouldCopyContentsOnly(record.source.type, record.folderMode) ? '/' : '';
    if (record.direction === 'upload') {
      args.push(`${record.source.path}${sourceSuffix}`, `${vm.username}@${vm.host}:${record.destination.directory}/`);
    } else {
      args.push(`${vm.username}@${vm.host}:${record.source.path}${sourceSuffix}`, `${record.destination.directory}/`);
    }
    return args;
  }

  private handleOutput(id: string, text: string, context: RsyncContext): void {
    context.emitLog(text.trim());
    const match = text.match(/\s([0-9,]+)\s+(\d+)%/);
    if (!match) return;
    const transferredBytes = Number(match[1].replace(/,/g, ''));
    const percent = Number(match[2]);
    context.emitProgress({ id, transferredBytes, totalBytes: null, percent });
  }
}
