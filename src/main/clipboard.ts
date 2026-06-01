import { DEFAULTS } from '@shared/constants';

export interface ClipboardLike {
  writeText(text: string): void;
  clear(): void;
}

export class ClipboardService {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly clipboard: ClipboardLike,
    private readonly ttlMs: number = DEFAULTS.CLIPBOARD_CLEAR_MS,
  ) {}

  copySecret(secret: string): void {
    this.clipboard.writeText(secret);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.clipboard.clear();
      this.timer = null;
    }, this.ttlMs);
  }
}
