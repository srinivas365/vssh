import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  shouldAttachTerminalClipboardHandler,
  shouldHandleTerminalCopy,
  shouldHandleTerminalPaste,
} from '../../src/renderer/components/Terminal/terminal-clipboard';

function stubNavigator(platform: string, userAgent: string): void {
  vi.stubGlobal('navigator', { platform, userAgent });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('shouldAttachTerminalClipboardHandler', () => {
  it('enables Ctrl clipboard on Windows and Linux', () => {
    stubNavigator('Win32', 'Mozilla/5.0 (Windows NT 10.0)');
    expect(shouldAttachTerminalClipboardHandler()).toBe(true);
    stubNavigator('Linux x86_64', 'Mozilla/5.0 (X11; Linux x86_64)');
    expect(shouldAttachTerminalClipboardHandler()).toBe(true);
  });

  it('skips custom handler on macOS', () => {
    stubNavigator('MacIntel', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)');
    expect(shouldAttachTerminalClipboardHandler()).toBe(false);
  });
});

describe('shouldHandleTerminalCopy', () => {
  it('copies on Ctrl+Shift+C', () => {
    expect(shouldHandleTerminalCopy({ ctrlKey: true, metaKey: false, shiftKey: true, key: 'C' }, false)).toBe(true);
  });

  it('copies on Ctrl+C when text is selected', () => {
    expect(shouldHandleTerminalCopy({ ctrlKey: true, metaKey: false, shiftKey: false, key: 'c' }, true)).toBe(true);
  });

  it('does not copy on Ctrl+C without selection', () => {
    expect(shouldHandleTerminalCopy({ ctrlKey: true, metaKey: false, shiftKey: false, key: 'c' }, false)).toBe(false);
  });

  it('copies on Ctrl+Insert when text is selected', () => {
    expect(shouldHandleTerminalCopy({ ctrlKey: true, metaKey: false, shiftKey: false, key: 'Insert' }, true)).toBe(true);
  });
});

describe('shouldHandleTerminalPaste', () => {
  it('pastes on Ctrl+V', () => {
    expect(shouldHandleTerminalPaste({ ctrlKey: true, metaKey: false, shiftKey: false, key: 'v' })).toBe(true);
  });

  it('pastes on Ctrl+Shift+V', () => {
    expect(shouldHandleTerminalPaste({ ctrlKey: true, metaKey: false, shiftKey: true, key: 'V' })).toBe(true);
  });

  it('pastes on Shift+Insert', () => {
    expect(shouldHandleTerminalPaste({ ctrlKey: false, metaKey: false, shiftKey: true, key: 'Insert' })).toBe(true);
  });
});
