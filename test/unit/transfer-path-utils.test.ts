import { describe, expect, it } from 'vitest';
import { basenameForPath, joinRemotePath, computeFinalDestination, shouldCopyContentsOnly } from '../../src/main/transfer/path-utils';

describe('transfer path utilities', () => {
  it('extracts basenames from local and remote paths', () => {
    expect(basenameForPath('/Users/me/file.txt')).toBe('file.txt');
    expect(basenameForPath('/var/log/nginx/')).toBe('nginx');
  });

  it('joins remote paths without duplicate slashes', () => {
    expect(joinRemotePath('/home/admin', 'app.log')).toBe('/home/admin/app.log');
    expect(joinRemotePath('/home/admin/', 'app.log')).toBe('/home/admin/app.log');
    expect(joinRemotePath('/', 'tmp')).toBe('/tmp');
  });

  it('preserves source name for file destination', () => {
    expect(computeFinalDestination('/tmp/downloads', '/var/log/app.log', 'file', 'as-is')).toBe('/tmp/downloads/app.log');
  });

  it('preserves folder name by default', () => {
    expect(computeFinalDestination('/tmp/downloads', '/var/log/nginx', 'directory', 'as-is')).toBe('/tmp/downloads/nginx');
  });

  it('uses selected destination for folder contents-only mode', () => {
    expect(computeFinalDestination('/tmp/downloads', '/var/log/nginx', 'directory', 'contents-only')).toBe('/tmp/downloads');
  });

  it('only copies contents for directories with contents-only mode', () => {
    expect(shouldCopyContentsOnly('directory', 'contents-only')).toBe(true);
    expect(shouldCopyContentsOnly('file', 'contents-only')).toBe(false);
    expect(shouldCopyContentsOnly('directory', 'as-is')).toBe(false);
  });
});
