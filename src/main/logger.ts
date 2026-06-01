type Level = 'debug' | 'info' | 'warn' | 'error';

export class Logger {
  private readonly redactions = new Set<string>();

  registerSecret(secret: string): void {
    if (secret.length >= 4) this.redactions.add(secret);
  }

  unregisterSecret(secret: string): void {
    this.redactions.delete(secret);
  }

  log(level: Level, msg: string, meta?: Record<string, unknown>): void {
    let safe = msg;
    for (const s of this.redactions) safe = safe.split(s).join('[REDACTED]');
    // eslint-disable-next-line no-console
    console[level === 'debug' ? 'log' : level](`[${level}]`, safe, meta ?? '');
  }
}

export const logger = new Logger();
