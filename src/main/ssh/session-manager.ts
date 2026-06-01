import { SshSession } from './session';

export class SessionManager {
  private readonly sessions = new Map<string, SshSession>();

  register(session: SshSession): void {
    this.sessions.set(session.id, session);
    session.on('exit', () => this.sessions.delete(session.id));
  }

  get(sessionId: string): SshSession | undefined {
    return this.sessions.get(sessionId);
  }

  list(): SshSession[] {
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
