import type { FileEntry } from 'ssh2';
import type { RemoteEntry, Vm, VaultEntry } from '@shared/types';
import { joinRemotePath } from './path-utils';
import { connectSftp } from './sftp-client';

function typeFromMode(mode: number): RemoteEntry['type'] {
  if ((mode & 0o170000) === 0o040000) return 'directory';
  if ((mode & 0o170000) === 0o100000) return 'file';
  if ((mode & 0o170000) === 0o120000) return 'symlink';
  return 'unknown';
}

export function mapSftpEntry(directory: string, entry: FileEntry): RemoteEntry {
  return {
    name: entry.filename,
    path: joinRemotePath(directory, entry.filename),
    type: typeFromMode(entry.attrs.mode),
    sizeBytes: Number.isFinite(entry.attrs.size) ? entry.attrs.size : null,
    modifiedAt: entry.attrs.mtime ? entry.attrs.mtime * 1000 : null,
  };
}

export function sortRemoteEntries(entries: RemoteEntry[]): RemoteEntry[] {
  return entries
    .filter((entry) => entry.name !== '.' && entry.name !== '..')
    .sort((a, b) => {
      if (a.type === 'directory' && b.type !== 'directory') return -1;
      if (a.type !== 'directory' && b.type === 'directory') return 1;
      return a.name.localeCompare(b.name);
    });
}

export class RemoteBrowserService {
  async list(vm: Vm, secret: VaultEntry | null, directory: string): Promise<RemoteEntry[]> {
    const conn = await connectSftp(vm, secret);
    try {
      const entries = await new Promise<FileEntry[]>((resolve, reject) => {
        conn.sftp.readdir(directory, (err, list) => (err ? reject(err) : resolve(list)));
      });
      return sortRemoteEntries(entries.map((entry) => mapSftpEntry(directory, entry)));
    } finally {
      conn.close();
    }
  }

  async stat(vm: Vm, secret: VaultEntry | null, remotePath: string): Promise<RemoteEntry | null> {
    const conn = await connectSftp(vm, secret);
    try {
      const attrs = await new Promise<import('ssh2').Stats>((resolve, reject) => {
        conn.sftp.stat(remotePath, (err, stats) => (err ? reject(err) : resolve(stats)));
      });
      return {
        name: remotePath.split('/').filter(Boolean).pop() ?? '/',
        path: remotePath,
        type: ((attrs.mode & 0o170000) === 0o040000) ? 'directory' : 'file',
        sizeBytes: Number.isFinite(attrs.size) ? attrs.size : null,
        modifiedAt: attrs.mtime ? attrs.mtime * 1000 : null,
      };
    } catch {
      return null;
    } finally {
      conn.close();
    }
  }
}
