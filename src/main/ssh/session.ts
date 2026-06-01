import { randomUUID } from 'node:crypto';
import { spawn, IPty } from 'node-pty';
import { EventEmitter } from 'node:events';
import { Vm, PromptType, SessionState } from '@shared/types';
import { PromptDetector } from './prompt-detector';

export interface SessionEvents {
  data: (chunk: string) => void;
  state: (state: SessionState) => void;
  promptDetected: (type: PromptType) => void;
  exit: (code: number) => void;
}

export class SshSession extends EventEmitter {
  readonly id: string = randomUUID();
  readonly vmId: number;
  private readonly pty: IPty;
  private readonly detector: PromptDetector;
  private state: SessionState;

  constructor(vm: Vm, cols = 80, rows = 24) {
    super();
    this.vmId = vm.id;
    this.state = { sessionId: this.id, vmId: vm.id, status: 'connecting', latencyMs: null, startedAt: Date.now() };

    const args: string[] = ['-p', String(vm.port)];
    if (vm.keyPath) args.push('-i', vm.keyPath);
    args.push('-o', 'StrictHostKeyChecking=accept-new');
    args.push(`${vm.username}@${vm.host}`);

    this.pty = spawn('ssh', args, {
      name: 'xterm-256color',
      cols,
      rows,
      env: process.env as Record<string, string>,
    });

    this.detector = new PromptDetector((type) => this.emit('promptDetected', type));

    this.pty.onData((chunk) => {
      this.detector.feed(chunk);
      this.emit('data', chunk);
      if (this.state.status === 'connecting' && /[$#]\s/.test(chunk)) {
        this.state = { ...this.state, status: 'connected' };
        this.emit('state', this.state);
      }
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
