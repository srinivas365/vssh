import { describe, expect, it } from 'vitest';
import { parseSshCommand, SshInputTracker, sshSuggestionKey, vmMatchesSshCommand } from '../../src/shared/parse-ssh-command';

describe('parseSshCommand', () => {
  it('parses user@host', () => {
    expect(parseSshCommand('ssh alice@example.com')).toEqual({
      username: 'alice',
      host: 'example.com',
      port: 22,
      keyPath: null,
    });
  });

  it('parses host with default username', () => {
    expect(parseSshCommand('ssh prod.internal', 'bob')).toEqual({
      username: 'bob',
      host: 'prod.internal',
      port: 22,
      keyPath: null,
    });
  });

  it('parses -p and -i flags', () => {
    expect(parseSshCommand('ssh -p 2222 -i ~/.ssh/id_ed25519 alice@10.0.0.5')).toEqual({
      username: 'alice',
      host: '10.0.0.5',
      port: 2222,
      keyPath: '~/.ssh/id_ed25519',
    });
  });

  it('parses -l username with host', () => {
    expect(parseSshCommand('ssh -l alice prod.internal')).toEqual({
      username: 'alice',
      host: 'prod.internal',
      port: 22,
      keyPath: null,
    });
  });

  it('parses sudo-prefixed ssh commands', () => {
    expect(parseSshCommand('sudo ssh alice@example.com')).toEqual({
      username: 'alice',
      host: 'example.com',
      port: 22,
      keyPath: null,
    });
  });

  it('parses bracketed IPv6 targets', () => {
    expect(parseSshCommand('ssh alice@[2001:db8::1]:2222')).toEqual({
      username: 'alice',
      host: '2001:db8::1',
      port: 2222,
      keyPath: null,
    });
  });

  it('parses -p after the host target', () => {
    expect(parseSshCommand('ssh ca_actionops@10.60.112.21 -p 2233')).toEqual({
      username: 'ca_actionops',
      host: '10.60.112.21',
      port: 2233,
      keyPath: null,
    });
  });

  it('parses user command with non-default port', () => {
    expect(parseSshCommand('ssh -p 2233 ca_actionops@10.60.112.21')).toEqual({
      username: 'ca_actionops',
      host: '10.60.112.21',
      port: 2233,
      keyPath: null,
    });
  });
  it('ignores non-ssh commands', () => {
    expect(parseSshCommand('scp file alice@example.com:/tmp')).toBeNull();
    expect(parseSshCommand('ls -la')).toBeNull();
    expect(parseSshCommand('')).toBeNull();
  });

  it('handles quoted arguments', () => {
    expect(parseSshCommand('ssh -i "/home/me/my key" alice@example.com')).toEqual({
      username: 'alice',
      host: 'example.com',
      port: 22,
      keyPath: '/home/me/my key',
    });
  });
});

describe('SshInputTracker', () => {
  it('detects ssh commands when Enter is pressed', () => {
    const tracker = new SshInputTracker();
    expect(tracker.feed('ssh alice@example.com')).toBeNull();
    expect(tracker.feed('\r')).toEqual({
      username: 'alice',
      host: 'example.com',
      port: 22,
      keyPath: null,
    });
  });

  it('handles backspace while editing the line', () => {
    const tracker = new SshInputTracker();
    expect(tracker.feed('ssh alice@exa')).toBeNull();
    expect(tracker.feed('\x7f')).toBeNull();
    expect(tracker.feed('ample.com\r')).toEqual({
      username: 'alice',
      host: 'example.com',
      port: 22,
      keyPath: null,
    });
  });

  it('ignores arrow-key escape sequences without clearing typed input', () => {
    const tracker = new SshInputTracker();
    expect(tracker.feed('ssh alice@example.com')).toBeNull();
    expect(tracker.feed('\x1b[A')).toBeNull();
    expect(tracker.feed('\r')).toEqual({
      username: 'alice',
      host: 'example.com',
      port: 22,
      keyPath: null,
    });
  });
});

describe('sshSuggestionKey', () => {
  it('builds a stable key', () => {
    expect(sshSuggestionKey({
      username: 'alice',
      host: 'example.com',
      port: 22,
      keyPath: null,
    })).toBe('alice@example.com:22');
  });
});

describe('vmMatchesSshCommand', () => {
  it('matches host, port, and username', () => {
    const parsed = { username: 'alice', host: 'example.com', port: 22, keyPath: null };
    expect(vmMatchesSshCommand({ host: 'example.com', port: 22, username: 'alice' }, parsed)).toBe(true);
    expect(vmMatchesSshCommand({ host: 'example.com', port: 2222, username: 'alice' }, parsed)).toBe(false);
  });
});
