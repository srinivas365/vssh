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
  markFailed: (error: string) => void;
}

export class SftpTransferEngine {
  private activeStreams = new Map<string, { destroy: (err: Error) => void }>();
  private abortedIds = new Set<string>();

  abort(id: string): void {
    this.abortedIds.add(id);
    const streams = this.activeStreams.get(id);
    if (streams) {
      streams.destroy(new Error('transfer-aborted'));
      this.activeStreams.delete(id);
    }
  }

  async start(record: TransferRecord, context: EngineContext): Promise<void> {
    this.abortedIds.delete(record.id);
    context.markRunning();
    context.emitLog('Starting SFTP transfer');
    const conn = await connectSftp(context.vm, context.secret);
    try {
      if (record.direction === 'upload') {
        if (record.source.type === 'directory') await this.uploadDirectory(record, context, conn.sftp);
        else await this.uploadFile(record, context, conn.sftp);
      } else {
        if (record.source.type === 'directory') await this.downloadDirectory(record, context, conn.sftp);
        else await this.downloadFile(record, context, conn.sftp);
      }
      context.markSucceeded();
    } catch (err) {
      if (!this.abortedIds.has(record.id)) {
        context.markFailed(err instanceof Error ? err.message : String(err));
      }
    } finally {
      conn.close();
      this.abortedIds.delete(record.id);
    }
  }

  private async ensureRemoteDir(sftp: import('ssh2').SFTPWrapper, dir: string): Promise<void> {
    const parts = dir.split('/').filter(Boolean);
    let current = '';
    for (const part of parts) {
      current += `/${part}`;
      await new Promise<void>((resolve) => sftp.mkdir(current, () => resolve()));
    }
  }

  private walkLocalFiles(root: string): string[] {
    const stat = fs.statSync(root);
    if (stat.isFile()) return [root];
    const out: string[] = [];
    for (const name of fs.readdirSync(root)) {
      const child = path.join(root, name);
      const childStat = fs.statSync(child);
      if (childStat.isDirectory()) out.push(...this.walkLocalFiles(child));
      else if (childStat.isFile()) out.push(child);
    }
    return out;
  }

  private async readdir(sftp: import('ssh2').SFTPWrapper, dir: string): Promise<import('ssh2').FileEntry[]> {
    return new Promise((resolve, reject) => sftp.readdir(dir, (err, list) => err ? reject(err) : resolve(list)));
  }

  private async walkRemoteFiles(sftp: import('ssh2').SFTPWrapper, root: string): Promise<string[]> {
    const entries = await this.readdir(sftp, root);
    const out: string[] = [];
    for (const entry of entries) {
      if (entry.filename === '.' || entry.filename === '..') continue;
      const child = `${root.replace(/\/+$/, '')}/${entry.filename}`;
      const kind = entry.attrs.mode & 0o170000;
      if (kind === 0o040000) out.push(...await this.walkRemoteFiles(sftp, child));
      else if (kind === 0o100000) out.push(child);
    }
    return out;
  }

  private async uploadDirectory(record: TransferRecord, context: EngineContext, sftp: import('ssh2').SFTPWrapper): Promise<void> {
    const files = this.walkLocalFiles(record.source.path);
    const root = record.source.path.replace(/[\/]+$/, '');
    for (const file of files) {
      if (this.abortedIds.has(record.id)) break;
      const relative = path.relative(root, file).split(path.sep).join('/');
      const remoteBase = record.folderMode === 'contents-only' ? record.destination.directory : record.destination.finalPath;
      const remotePath = `${remoteBase.replace(/\/+$/, '')}/${relative}`;
      await this.ensureRemoteDir(sftp, remotePath.replace(/\/[^/]+$/, ''));
      const childRecord = { ...record, source: { path: file, name: path.basename(file), type: 'file' as const }, destination: { directory: remotePath.replace(/\/[^/]+$/, ''), finalPath: remotePath } };
      await this.uploadFile(childRecord, context, sftp);
    }
  }

  private async downloadDirectory(record: TransferRecord, context: EngineContext, sftp: import('ssh2').SFTPWrapper): Promise<void> {
    const files = await this.walkRemoteFiles(sftp, record.source.path);
    const root = record.source.path.replace(/\/+$/, '');
    const localBase = record.folderMode === 'contents-only' ? record.destination.directory : record.destination.finalPath;
    for (const remotePath of files) {
      if (this.abortedIds.has(record.id)) break;
      const relative = remotePath.slice(root.length).replace(/^\/+/, '');
      const localPath = path.join(localBase, relative);
      const childRecord = { ...record, source: { path: remotePath, name: path.posix.basename(remotePath), type: 'file' as const }, destination: { directory: path.dirname(localPath), finalPath: localPath } };
      await this.downloadFile(childRecord, context, sftp);
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
      // write is an ssh2 stream whose destroy() accepts no error arg — pass err to read (fs stream) only
      this.activeStreams.set(record.id, { destroy: (err) => { read.destroy(err); write.destroy(); } });
      const cleanup = () => this.activeStreams.delete(record.id);
      write.once('close', () => { cleanup(); resolve(); });
      read.once('error', (err: Error) => { cleanup(); reject(err); });
      write.once('error', (err: Error) => { cleanup(); reject(err); });
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
      // read is an ssh2 stream whose destroy() accepts no error arg — pass err to write (fs stream) only
      this.activeStreams.set(record.id, { destroy: (err) => { read.destroy(); write.destroy(err); } });
      const cleanup = () => this.activeStreams.delete(record.id);
      write.once('close', () => { cleanup(); resolve(); });
      read.once('error', (err: Error) => { cleanup(); reject(err); });
      write.once('error', (err: Error) => { cleanup(); reject(err); });
      read.pipe(write);
    });
  }
}
