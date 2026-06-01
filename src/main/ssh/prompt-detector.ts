import { PromptType } from '@shared/types';
import { DEFAULTS } from '@shared/constants';

const PATTERNS: Array<{ type: PromptType; re: RegExp; phase: 'login' | 'any' }> = [
  { type: 'key-passphrase', re: /Enter passphrase for key '[^']*':\s*$/i, phase: 'any' },
  { type: 'login', re: /\S+@\S+'s password:\s*$/i, phase: 'any' },
  { type: 'sudo', re: /\[sudo\] password for \S+:\s*$/i, phase: 'any' },
  { type: 'login', re: /password:\s*$/i, phase: 'login' },
  { type: 'sudo', re: /password:\s*$/i, phase: 'any' },
];

export class PromptDetector {
  private buffer = '';
  private startedAt = Date.now();
  private lastFireAt = 0;

  constructor(
    private readonly onMatch: (type: PromptType) => void,
    private readonly bufferBytes: number = DEFAULTS.PTY_BUFFER_BYTES,
    private readonly debounceMs: number = DEFAULTS.PROMPT_DEBOUNCE_MS,
    private readonly loginWindowMs: number = DEFAULTS.LOGIN_PROMPT_WINDOW_MS,
  ) {}

  feed(chunk: string): void {
    this.buffer = (this.buffer + chunk).slice(-this.bufferBytes);
    const now = Date.now();
    if (now - this.lastFireAt < this.debounceMs) return;

    const inLoginWindow = now - this.startedAt < this.loginWindowMs;
    const tail = this.lastLine(this.buffer);

    for (const { type, re, phase } of PATTERNS) {
      if (phase === 'login' && !inLoginWindow) continue;
      if (re.test(tail)) {
        this.lastFireAt = now;
        this.onMatch(type);
        return;
      }
    }
  }

  reset(): void {
    this.buffer = '';
    this.startedAt = Date.now();
    this.lastFireAt = 0;
  }

  private lastLine(s: string): string {
    const idx = Math.max(s.lastIndexOf('\n'), s.lastIndexOf('\r'));
    return idx >= 0 ? s.slice(idx + 1) : s;
  }
}
