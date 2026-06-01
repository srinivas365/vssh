import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { SessionManager } from '../../src/main/ssh/session-manager';

class FakeSession extends EventEmitter {
  id = 'fake-' + Math.random();
  vmId = 1;
  killed = false;
  written: string[] = [];
  write(s: string) { this.written.push(s); }
  resize() {}
  getState() { return { sessionId: this.id, vmId: 1, status: 'connecting' as const, latencyMs: null, startedAt: 0 }; }
  kill() { this.killed = true; this.emit('exit', 0); }
}

describe('SessionManager', () => {
  it('tracks sessions and removes them on exit', () => {
    const m = new SessionManager();
    const s = new FakeSession();
    m.register(s as any);
    expect(m.list()).toHaveLength(1);
    s.emit('exit', 0);
    expect(m.list()).toHaveLength(0);
  });

  it('routes input to the right session', () => {
    const m = new SessionManager();
    const s = new FakeSession();
    m.register(s as any);
    m.write(s.id, 'hello');
    expect(s.written).toEqual(['hello']);
  });

  it('kills a session on close()', () => {
    const m = new SessionManager();
    const s = new FakeSession();
    m.register(s as any);
    m.close(s.id);
    expect(s.killed).toBe(true);
  });

  it('write on unknown session is a no-op', () => {
    const m = new SessionManager();
    expect(() => m.write('nonexistent', 'x')).not.toThrow();
  });
});
