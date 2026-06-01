// src/main/logger.ts
//
// A small, redaction-aware logger for the main process.
//
// Goals:
//   * Never log plaintext secrets, even when callers are sloppy with structured
//     metadata.
//   * Provide an explicit `registerSecret` channel so values pulled out of the
//     vault can be redacted from any message that happens to embed them.
//   * Stay dependency-free and side-effect-light so it can be imported from
//     anywhere in the main process.

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const DEFAULT_LEVEL: LogLevel =
  process.env.NODE_ENV === 'production' ? 'info' : 'debug';

// Keys whose values should always be redacted regardless of their content.
const SENSITIVE_KEY_RE =
  /(password|passwd|secret|token|apikey|api_key|authorization|auth|cookie|session|passphrase|private[_-]?key|master[_-]?pw)/i;

// Patterns we redact from free-form strings even when no key is attached.
const VALUE_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  // Stringified PEM blocks.
  {
    name: 'pem',
    regex:
      /-----BEGIN [A-Z0-9 ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]+PRIVATE KEY-----/g,
  },
  // Bearer / Basic auth headers.
  { name: 'bearer', regex: /\b(Bearer|Basic)\s+[A-Za-z0-9._\-+/=]+/g },
];

const REDACTED = '[REDACTED]';

export interface LogFields {
  [key: string]: unknown;
}

export interface LoggerOptions {
  level?: LogLevel;
  /** Sink for serialized log lines. Defaults to console.* per level. */
  sink?: (level: LogLevel, line: string) => void;
}

class LoggerImpl {
  private level: LogLevel;
  private readonly sink: (level: LogLevel, line: string) => void;
  // Concrete secret values that should be scrubbed from any log line.
  private readonly secrets = new Set<string>();

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? DEFAULT_LEVEL;
    this.sink = options.sink ?? defaultSink;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Register a literal secret string that must be redacted from any future
   * log line. Empty / very short strings are ignored to avoid accidental
   * mass-redaction (e.g. the empty string would match everywhere).
   */
  registerSecret(secret: string | null | undefined): void {
    if (!secret || secret.length < 4) return;
    this.secrets.add(secret);
  }

  forgetSecret(secret: string): void {
    this.secrets.delete(secret);
  }

  clearSecrets(): void {
    this.secrets.clear();
  }

  debug(msg: string, fields?: LogFields): void { this.emit('debug', msg, fields); }
  info(msg: string, fields?: LogFields): void { this.emit('info', msg, fields); }
  warn(msg: string, fields?: LogFields): void { this.emit('warn', msg, fields); }
  error(msg: string, fields?: LogFields): void { this.emit('error', msg, fields); }

  private emit(level: LogLevel, msg: string, fields?: LogFields): void {
    if (LEVEL_RANK[level] < LEVEL_RANK[this.level]) return;

    const safeMsg = this.scrubString(msg);
    const safeFields = fields ? this.scrubFields(fields) : undefined;

    const entry = {
      ts: new Date().toISOString(),
      level,
      msg: safeMsg,
      ...(safeFields ? { fields: safeFields } : {}),
    };

    let line: string;
    try {
      line = JSON.stringify(entry);
    } catch {
      line = JSON.stringify({
        ts: entry.ts,
        level,
        msg: safeMsg,
        fields: '[unserializable]',
      });
    }
    this.sink(level, line);
  }

  private scrubFields(fields: LogFields): LogFields {
    return this.scrubValue(fields, new WeakSet()) as LogFields;
  }

  private scrubValue(value: unknown, seen: WeakSet<object>): unknown {
    if (value === null || value === undefined) return value;
    if (typeof value === 'string') return this.scrubString(value);
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
      return value;
    }
    if (value instanceof Error) {
      return {
        name: value.name,
        message: this.scrubString(value.message),
        stack: value.stack ? this.scrubString(value.stack) : undefined,
      };
    }
    if (Buffer.isBuffer(value)) {
      return `[Buffer ${value.length}B]`;
    }
    if (Array.isArray(value)) {
      if (seen.has(value)) return '[Circular]';
      seen.add(value);
      return value.map((v) => this.scrubValue(v, seen));
    }
    if (typeof value === 'object') {
      if (seen.has(value as object)) return '[Circular]';
      seen.add(value as object);
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (SENSITIVE_KEY_RE.test(k)) {
          out[k] = REDACTED;
        } else {
          out[k] = this.scrubValue(v, seen);
        }
      }
      return out;
    }
    // functions, symbols, etc.
    return `[${typeof value}]`;
  }

  private scrubString(input: string): string {
    let s = input;
    for (const { regex } of VALUE_PATTERNS) {
      s = s.replace(regex, REDACTED);
    }
    if (this.secrets.size > 0) {
      for (const secret of this.secrets) {
        if (!secret) continue;
        // Split-join avoids the need to escape regex metacharacters.
        if (s.includes(secret)) {
          s = s.split(secret).join(REDACTED);
        }
      }
    }
    return s;
  }
}

function defaultSink(level: LogLevel, line: string): void {
  // eslint-disable-next-line no-console
  const fn =
    level === 'error' ? console.error :
    level === 'warn'  ? console.warn  :
    level === 'debug' ? console.debug :
                        console.log;
  fn(line);
}

export type Logger = LoggerImpl;

/**
 * Process-wide logger singleton. Tests can construct their own via
 * `createLogger` if they need isolated state.
 */
export const logger: Logger = new LoggerImpl();

export function createLogger(options: LoggerOptions = {}): Logger {
  return new LoggerImpl(options);
}
