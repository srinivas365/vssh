import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { spawn, IPty } from 'node-pty';
import { SessionState } from '@shared/types';

export interface LocalSessionEvents {
  data: (chunk: string) => void;
  state: (state: SessionState) => void;
  exit: (code: number) => void;
}

export class LocalSession extends EventEmitter {
  readonly id: string = randomUUID();
  readonly vmId: null = null;
  private readonly pty: IPty;
  private state: SessionState;

  constructor(cols = 80, rows = 24) {
    super();
    this.state = { sessionId: this.id, vmId: null, status: 'connected', latencyMs: null, startedAt: Date.now() };

    this.pty = spawn(resolveLocalShell(), [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: resolveLocalCwd(),
      env: process.env as Record<string, string>,
    });

    this.pty.onData((chunk) => {
      this.emit('data', chunk);
    });

    this.pty.onExit(({ exitCode }) => {
      this.state = { ...this.state, status: 'closed' };
      this.emit('state', this.state);
      this.emit('exit', exitCode);
    });
  }

  write(data: string): void {
    this.pty.write(data);
  }

  resize(cols: number, rows: number): void {
    this.pty.resize(cols, rows);
  }

  getState(): SessionState {
    return this.state;
  }

  kill(): void {
    this.pty.kill();
  }
}

export function resolveLocalShell(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform
): string {
  if (platform === 'win32') return env.COMSPEC || 'cmd.exe';
  if (env.SHELL) return env.SHELL;
  return platform === 'darwin' ? '/bin/zsh' : '/bin/bash';
}

function resolveLocalCwd(): string {
  return process.env.HOME || process.env.USERPROFILE || process.cwd();
}
