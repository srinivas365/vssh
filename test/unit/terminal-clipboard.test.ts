import { describe, expect, it } from 'vitest';
import { shouldHandleTerminalCopy, shouldHandleTerminalPaste } from '../../src/renderer/components/Terminal/terminal-clipboard';

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
