// test/unit/clipboard.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ClipboardService } from '../../src/main/clipboard';

describe('ClipboardService', () => {
  let writes: string[];
  let current: string;
  let writeText: (s: string) => void;
  let readText: () => string;
  let service: ClipboardService;

  beforeEach(() => {
    vi.useFakeTimers();
    writes = [];
    current = 'previous-clipboard-content';
    writeText = (s: string) => { writes.push(s); current = s; };
    readText = () => current;
    service = new ClipboardService({ writeText, readText }, 30_000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('writes the secret to the clipboard immediately', () => {
    service.copySecret('hunter2');
    expect(writes).toContain('hunter2');
    expect(current).toBe('hunter2');
  });

  it('clears the clipboard after the auto-clear timeout', () => {
    service.copySecret('hunter2');
    expect(current).toBe('hunter2');

    vi.advanceTimersByTime(29_999);
    expect(current).toBe('hunter2');

    vi.advanceTimersByTime(1);
    expect(current).toBe('');
  });

  it('does not clear the clipboard if the user has overwritten it', () => {
    service.copySecret('hunter2');
    // user copies something else
    current = 'something-else';

    vi.advanceTimersByTime(30_000);
    // should not be wiped because the value no longer matches the secret
    expect(current).toBe('something-else');
  });
});
