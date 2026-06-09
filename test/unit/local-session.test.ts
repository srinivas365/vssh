import { describe, expect, it } from 'vitest';
import { resolveLocalShell } from '../../src/main/ssh/local-session';

describe('resolveLocalShell', () => {
  it('uses SHELL on macOS and Unix-like platforms when available', () => {
    expect(resolveLocalShell({ SHELL: '/bin/fish' }, 'darwin')).toBe('/bin/fish');
    expect(resolveLocalShell({ SHELL: '/usr/bin/zsh' }, 'linux')).toBe('/usr/bin/zsh');
  });

  it('falls back to common login shells on macOS and Linux', () => {
    expect(resolveLocalShell({}, 'darwin')).toBe('/bin/zsh');
    expect(resolveLocalShell({}, 'linux')).toBe('/bin/bash');
  });

  it('uses COMSPEC on Windows when available', () => {
    expect(resolveLocalShell({ COMSPEC: 'C:\\Windows\\System32\\cmd.exe' }, 'win32')).toBe(
      'C:\\Windows\\System32\\cmd.exe'
    );
  });

  it('falls back to cmd.exe on Windows', () => {
    expect(resolveLocalShell({}, 'win32')).toBe('cmd.exe');
  });
});
