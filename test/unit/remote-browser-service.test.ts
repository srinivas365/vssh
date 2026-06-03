import { describe, expect, it } from 'vitest';
import { mapSftpEntry, sortRemoteEntries } from '../../src/main/transfer/remote-browser-service';

describe('remote browser service helpers', () => {
  it('maps sftp directory entries to remote entries', () => {
    const entry = mapSftpEntry('/home/admin', {
      filename: 'logs',
      longname: 'drwxr-xr-x 1 admin admin 64 Jun 1 logs',
      attrs: { mode: 0o040755, size: 64, mtime: 1717200000, atime: 1717200000, uid: 1000, gid: 1000 },
    });

    expect(entry).toEqual({
      name: 'logs',
      path: '/home/admin/logs',
      type: 'directory',
      sizeBytes: 64,
      modifiedAt: 1717200000000,
    });
  });

  it('sorts directories before files and ignores dot navigation entries', () => {
    const sorted = sortRemoteEntries([
      { name: 'z.txt', path: '/z.txt', type: 'file', sizeBytes: 1, modifiedAt: null },
      { name: 'app', path: '/app', type: 'directory', sizeBytes: null, modifiedAt: null },
      { name: '.', path: '/.', type: 'directory', sizeBytes: null, modifiedAt: null },
    ]);

    expect(sorted.map((x) => x.name)).toEqual(['app', 'z.txt']);
  });
});
