import { EventEmitter } from 'node:events';
import { SessionState } from '@shared/types';

export interface ManagedSession extends EventEmitter {
  readonly id: string;
  readonly vmId: number | null;
  write(data: string): void;
  resize(cols: number, rows: number): void;
  getState(): SessionState;
  kill(): void;
}

export class SessionManager {
  private readonly sessions = new Map<string, ManagedSession>();

  register(session: ManagedSession): void {
    this.sessions.set(session.id, session);
    session.on('exit', () => this.sessions.delete(session.id));
  }

  get(sessionId: string): ManagedSession | undefined {
    return this.sessions.get(sessionId);
  }

  list(): ManagedSession[] {
    return Array.from(this.sessions.values());
  }

  write(sessionId: string, data: string): void {
    this.sessions.get(sessionId)?.write(data);
  }

  resize(sessionId: string, cols: number, rows: number): void {
    this.sessions.get(sessionId)?.resize(cols, rows);
  }

  close(sessionId: string): void {
    this.sessions.get(sessionId)?.kill();
  }

  closeAll(): void {
    for (const s of this.sessions.values()) s.kill();
    this.sessions.clear();
  }
}
