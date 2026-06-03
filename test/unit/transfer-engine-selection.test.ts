import { describe, expect, it } from 'vitest';
import { chooseTransferEngine, parseCommandExistsExit } from '../../src/main/transfer/engine-selection';

describe('transfer engine selection', () => {
  it('chooses rsync when local and remote rsync are both available', () => {
    expect(chooseTransferEngine({ localRsync: true, remoteRsync: true })).toBe('rsync');
  });

  it('falls back to sftp when local rsync is missing', () => {
    expect(chooseTransferEngine({ localRsync: false, remoteRsync: true })).toBe('sftp');
  });

  it('falls back to sftp when remote rsync is missing', () => {
    expect(chooseTransferEngine({ localRsync: true, remoteRsync: false })).toBe('sftp');
  });

  it('treats exit code 0 as command available', () => {
    expect(parseCommandExistsExit(0)).toBe(true);
    expect(parseCommandExistsExit(1)).toBe(false);
    expect(parseCommandExistsExit(null)).toBe(false);
  });
});
