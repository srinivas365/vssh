import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClipboardService } from '../../src/main/clipboard';

const fakeClipboard = {
  text: '',
  writeText(t: string) { this.text = t; },
  clear() { this.text = ''; },
};

beforeEach(() => { vi.useFakeTimers(); fakeClipboard.text = ''; });
afterEach(() => { vi.useRealTimers(); });

describe('ClipboardService', () => {
  it('writes the secret', () => {
    const c = new ClipboardService(fakeClipboard as any, 1000);
    c.copySecret('hunter2');
    expect(fakeClipboard.text).toBe('hunter2');
  });

  it('clears after the configured TTL', () => {
    const c = new ClipboardService(fakeClipboard as any, 1000);
    c.copySecret('hunter2');
    vi.advanceTimersByTime(999);
    expect(fakeClipboard.text).toBe('hunter2');
    vi.advanceTimersByTime(1);
    expect(fakeClipboard.text).toBe('');
  });

  it('resets the timer when a second copy happens', () => {
    const c = new ClipboardService(fakeClipboard as any, 1000);
    c.copySecret('first');
    vi.advanceTimersByTime(500);
    c.copySecret('second');
    vi.advanceTimersByTime(800);
    expect(fakeClipboard.text).toBe('second');
    vi.advanceTimersByTime(300);
    expect(fakeClipboard.text).toBe('');
  });
});
