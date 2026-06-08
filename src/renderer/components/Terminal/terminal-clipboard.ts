import type { Terminal } from '@xterm/xterm';

export interface TerminalClipboardApi {
  readText(): Promise<string>;
  writeText(text: string): Promise<void>;
}

function isWindows(): boolean {
  return navigator.platform.toLowerCase().includes('win')
    || navigator.userAgent.toLowerCase().includes('windows');
}

export function shouldHandleTerminalCopy(
  event: Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'shiftKey' | 'key'>,
  hasSelection: boolean,
): boolean {
  const copyKey = event.key === 'c' || event.key === 'C';
  const mod = event.ctrlKey && !event.metaKey;
  if (mod && copyKey) return event.shiftKey || hasSelection;
  return event.key === 'Insert' && event.ctrlKey && !event.shiftKey && hasSelection;
}

export function shouldHandleTerminalPaste(
  event: Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'shiftKey' | 'key'>,
): boolean {
  const pasteKey = event.key === 'v' || event.key === 'V';
  const mod = event.ctrlKey && !event.metaKey;
  if (mod && pasteKey) return true;
  return event.key === 'Insert' && event.shiftKey && !event.ctrlKey;
}

async function copySelection(term: Terminal, clipboard: TerminalClipboardApi): Promise<void> {
  const text = term.getSelection();
  if (!text) return;
  await clipboard.writeText(text);
}

async function pasteFromClipboard(term: Terminal, clipboard: TerminalClipboardApi): Promise<void> {
  const text = await clipboard.readText();
  if (text) term.paste(text);
}

export function attachTerminalClipboard(
  term: Terminal,
  clipboard: TerminalClipboardApi = window.api.clipboard,
): void {
  if (!isWindows()) return;

  term.attachCustomKeyEventHandler((event) => {
    if (event.type !== 'keydown') return true;

    if (shouldHandleTerminalCopy(event, term.hasSelection())) {
      event.preventDefault();
      void copySelection(term, clipboard);
      return false;
    }

    if (shouldHandleTerminalPaste(event)) {
      event.preventDefault();
      void pasteFromClipboard(term, clipboard).catch(() => {});
      return false;
    }

    return true;
  });
}
