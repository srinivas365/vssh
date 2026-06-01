// src/main/clipboard.ts
import { DEFAULTS } from '@shared/constants';

export interface ClipboardLike {
  writeText(text: string): void;
  readText(): string;
}

/**
 * Writes secrets to the OS clipboard with an automatic clear after a timeout.
 *
 * The clear is conditional: if the user has copied something else in the
 * meantime, we leave their content alone.
 */
export class ClipboardService {
  private timer: NodeJS.Timeout | null = null;
  private lastWritten: string | null = null;

  constructor(
    private readonly clipboard: ClipboardLike,
    private readonly clearMs: number = DEFAULTS.CLIPBOARD_CLEAR_MS,
  ) {}

  copySecret(value: string): void {
    this.cancelPendingClear();
    this.clipboard.writeText(value);
    this.lastWritten = value;
    this.timer = setTimeout(() => {
      try {
        if (this.clipboard.readText() === this.lastWritten) {
          this.clipboard.writeText('');
        }
      } finally {
        this.lastWritten = null;
        this.timer = null;
      }
    }, this.clearMs);
    // Don't keep the event loop alive just to clear the clipboard.
    if (typeof (this.timer as { unref?: () => void }).unref === 'function') {
      (this.timer as { unref: () => void }).unref();
    }
  }

  /**
   * Cancel any pending auto-clear timer (e.g. on app quit or vault lock).
   */
  cancelPendingClear(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.lastWritten = null;
  }
}
