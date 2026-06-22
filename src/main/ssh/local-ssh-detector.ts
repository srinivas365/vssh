import { ParsedSshCommand } from '@shared/parse-ssh-command';
import { DEFAULTS } from '@shared/constants';

const SSH_PASSWORD_PROMPT = /^(\S+)@(\S+)'s password:\s*$/i;

/** Detects ssh connections from local-terminal PTY output (password prompt, host key messages). */
export class LocalSshOutputDetector {
  private buffer = '';
  private lastFireAt = 0;

  constructor(
    private readonly onMatch: (parsed: ParsedSshCommand) => void,
    private readonly bufferBytes = 4096,
    private readonly debounceMs = DEFAULTS.PROMPT_DEBOUNCE_MS,
  ) {}

  /** Allow the next password prompt to trigger a suggestion (new ssh command submitted). */
  resetForNewCommand(): void {
    this.buffer = '';
    this.lastFireAt = Date.now() - this.debounceMs - 1;
  }

  feed(chunk: string): void {
    this.buffer = (this.buffer + chunk).slice(-this.bufferBytes);
    const now = Date.now();
    if (now - this.lastFireAt < this.debounceMs) return;

    const tail = this.lastLine(this.buffer);
    const match = tail.match(SSH_PASSWORD_PROMPT);
    if (!match) return;

    const username = match[1];
    const host = match[2];
    const port = this.findPortForHost(host) ?? 22;
    const parsed: ParsedSshCommand = { username, host, port, keyPath: null };
    this.lastFireAt = now;
    this.onMatch(parsed);
  }

  private findPortForHost(host: string): number | null {
    const escaped = host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(`\\[${escaped}\\]:(\\d+)`),
      new RegExp(`'\\[${escaped}\\]:(\\d+)'`),
      new RegExp(`${escaped}:(\\d+)(?![0-9])`),
      new RegExp(`-p\\s+(\\d+)(?=[\\s'"]|$)[\\s\\S]{0,200}${escaped}`),
      new RegExp(`${escaped}[\\s\\S]{0,200}-p\\s+(\\d+)(?=[\\s'"]|$)`),
    ];

    for (const re of patterns) {
      const m = this.buffer.match(re);
      if (!m) continue;
      const port = Number(m[1]);
      if (Number.isFinite(port) && port > 0 && port <= 65535) return port;
    }
    return null;
  }

  private lastLine(s: string): string {
    const idx = Math.max(s.lastIndexOf('\n'), s.lastIndexOf('\r'));
    return idx >= 0 ? s.slice(idx + 1) : s;
  }
}
