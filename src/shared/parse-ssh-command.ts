export interface ParsedSshCommand {
  username: string;
  host: string;
  port: number;
  keyPath: string | null;
}

const FLAGS_WITH_VALUE = new Set([
  '-p', '-P', '-i', '-l', '-o', '-J', '-b', '-c', '-F', '-L', '-R', '-D', '-W', '-w', '-E', '-e',
]);

/** Parse a single shell line for a plain `ssh` invocation. */
export function parseSshCommand(line: string, defaultUsername = ''): ParsedSshCommand | null {
  let trimmed = line.trim();
  if (!trimmed) return null;

  trimmed = trimmed.replace(/^(?:sudo\s+)+/i, '').trim();
  if (!/^ssh(\s|$)/i.test(trimmed)) return null;

  const tokens = tokenizeShellLine(trimmed);
  if (tokens.length === 0 || tokens[0].toLowerCase() !== 'ssh') return null;

  let port = 22;
  let keyPath: string | null = null;
  let username: string | null = null;
  let host: string | null = null;

  for (let i = 1; i < tokens.length; i++) {
    const arg = tokens[i];
    if (arg.startsWith('-')) {
      const eq = arg.indexOf('=');
      const flag = eq >= 0 ? arg.slice(0, eq) : arg;
      const inlineValue = eq >= 0 ? arg.slice(eq + 1) : undefined;
      if (!FLAGS_WITH_VALUE.has(flag)) continue;

      const value = inlineValue ?? tokens[++i];
      if (value === undefined) return null;

      if (flag === '-p' || flag === '-P') {
        const parsedPort = Number(value);
        if (!Number.isFinite(parsedPort) || parsedPort <= 0 || parsedPort > 65535) return null;
        port = parsedPort;
      } else if (flag === '-i') {
        keyPath = value;
      } else if (flag === '-l') {
        username = value;
      }
      continue;
    }

    const target = parseSshTarget(arg, defaultUsername, username);
    if (!target) return null;
    username = target.username;
    host = target.host;
    if (target.port !== null) port = target.port;
    continue;
  }

  if (!host) return null;
  return {
    username: username || defaultUsername,
    host,
    port,
    keyPath,
  };
}

function parseSshTarget(
  arg: string,
  defaultUsername: string,
  explicitUsername: string | null,
): { username: string; host: string; port: number | null } | null {
  const bracketMatch = arg.match(/^\[([^\]]+)\](?::(\d+))?$/);
  if (bracketMatch) {
    const host = bracketMatch[1];
    const port = bracketMatch[2] ? Number(bracketMatch[2]) : null;
    if (port !== null && (!Number.isFinite(port) || port <= 0 || port > 65535)) return null;
    return { username: explicitUsername || defaultUsername, host, port };
  }

  const atIdx = arg.lastIndexOf('@');
  if (atIdx > 0) {
    const user = explicitUsername || arg.slice(0, atIdx);
    const hostPart = arg.slice(atIdx + 1);
    const bracketHost = hostPart.match(/^\[([^\]]+)\](?::(\d+))?$/);
    if (bracketHost) {
      const host = bracketHost[1];
      const port = bracketHost[2] ? Number(bracketHost[2]) : null;
      if (port !== null && (!Number.isFinite(port) || port <= 0 || port > 65535)) return null;
      return { username: user, host, port };
    }
    const hostPort = splitHostPort(hostPart);
    if (!hostPort) return null;
    return { username: user, host: hostPort.host, port: hostPort.port };
  }

  const hostPort = splitHostPort(arg);
  if (!hostPort) return null;
  return { username: explicitUsername || defaultUsername, host: hostPort.host, port: hostPort.port };
}

function splitHostPort(value: string): { host: string; port: number | null } | null {
  const colonIdx = value.lastIndexOf(':');
  if (colonIdx > 0 && value.includes('.') && !value.slice(colonIdx + 1).includes('.')) {
    const maybePort = Number(value.slice(colonIdx + 1));
    if (Number.isFinite(maybePort) && maybePort > 0 && maybePort <= 65535) {
      return { host: value.slice(0, colonIdx), port: maybePort };
    }
  }
  if (!value) return null;
  return { host: value, port: null };
}

function tokenizeShellLine(line: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: "'" | '"' | null = null;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else if (ch === '\\' && quote === '"' && i + 1 < line.length) {
        current += line[++i];
      } else {
        current += ch;
      }
      continue;
    }

    if (ch === '\'' || ch === '"') {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += ch;
  }

  if (quote) return [];
  if (current) tokens.push(current);
  return tokens;
}

export function sshSuggestionKey(parsed: ParsedSshCommand): string {
  return `${parsed.username}@${parsed.host}:${parsed.port}`;
}

export function vmMatchesSshCommand(vm: { host: string; port: number; username: string }, parsed: ParsedSshCommand): boolean {
  return vm.host === parsed.host && vm.port === parsed.port && vm.username === parsed.username;
}

/** Accumulates PTY input until Enter, then parses completed lines for ssh commands. */
export class SshInputTracker {
  private line = '';

  constructor(private readonly defaultUsername = '') {}

  feed(data: string): ParsedSshCommand | null {
    let i = 0;
    while (i < data.length) {
      const char = data[i];

      if (char === '\x1b') {
        const consumed = this.consumeEscapeSequence(data, i);
        i += consumed;
        continue;
      }

      if (char === '\r' || char === '\n') {
        const parsed = parseSshCommand(this.line, this.defaultUsername);
        this.line = '';
        if (parsed) return parsed;
        i++;
        continue;
      }
      if (char === '\x7f' || char === '\b') {
        this.line = this.line.slice(0, -1);
        i++;
        continue;
      }
      if (char === '\x03' || char === '\x15') {
        this.line = '';
        i++;
        continue;
      }
      if (char >= ' ' || char === '\t') {
        this.line += char;
      }
      i++;
    }
    return null;
  }

  private consumeEscapeSequence(data: string, start: number): number {
    if (start + 1 >= data.length) return 1;
    const next = data[start + 1];

    // Bracketed paste start/end — ignore without clearing the typed line.
    if (next === '[' && data.startsWith('[200~', start + 1)) return 5;
    if (next === '[' && data.startsWith('[201~', start + 1)) return 5;

    // CSI sequences (arrows, home, etc.) — skip without clearing the line.
    if (next === '[') {
      let i = start + 2;
      while (i < data.length && !/[A-Za-z]/.test(data[i])) i++;
      return Math.min(i - start + 1, data.length - start);
    }

    // SS3 sequences
    if (next === 'O' && start + 2 < data.length) return 3;

    return 2;
  }
}
