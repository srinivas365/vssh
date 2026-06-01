// test/unit/prompt-detector.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PromptDetector } from '../../src/main/ssh/prompt-detector';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('PromptDetector', () => {
  it('detects ssh login prompt within first 5s', () => {
    const onMatch = vi.fn();
    const d = new PromptDetector(onMatch);
    d.feed("admin@10.0.0.1's password: ");
    expect(onMatch).toHaveBeenCalledWith('login');
  });

  it('detects bare "password:" within first 5s as login', () => {
    const onMatch = vi.fn();
    const d = new PromptDetector(onMatch);
    d.feed('password: ');
    expect(onMatch).toHaveBeenCalledWith('login');
  });

  it('treats bare "Password:" after 5s as sudo', () => {
    const onMatch = vi.fn();
    const d = new PromptDetector(onMatch);
    vi.advanceTimersByTime(6_000);
    d.feed('Password: ');
    expect(onMatch).toHaveBeenCalledWith('sudo');
  });

  it('detects sudo prompt with username', () => {
    const onMatch = vi.fn();
    const d = new PromptDetector(onMatch);
    vi.advanceTimersByTime(6_000);
    d.feed('[sudo] password for admin: ');
    expect(onMatch).toHaveBeenCalledWith('sudo');
  });

  it('detects key passphrase prompt', () => {
    const onMatch = vi.fn();
    const d = new PromptDetector(onMatch);
    d.feed("Enter passphrase for key '/home/u/.ssh/id_rsa': ");
    expect(onMatch).toHaveBeenCalledWith('key-passphrase');
  });

  it('does NOT fire on "password:" mid-line in a log', () => {
    const onMatch = vi.fn();
    const d = new PromptDetector(onMatch);
    d.feed('error: invalid password: format on line 42\n');
    expect(onMatch).not.toHaveBeenCalled();
  });

  it('debounces repeated prompts within 2s', () => {
    const onMatch = vi.fn();
    const d = new PromptDetector(onMatch);
    d.feed("admin@host's password: ");
    d.feed("admin@host's password: ");
    expect(onMatch).toHaveBeenCalledTimes(1);
  });

  it('fires again after debounce window', () => {
    const onMatch = vi.fn();
    const d = new PromptDetector(onMatch);
    d.feed("admin@host's password: ");
    vi.advanceTimersByTime(2_100);
    d.feed("admin@host's password: ");
    expect(onMatch).toHaveBeenCalledTimes(2);
  });

  it('reassembles a prompt split across chunks', () => {
    const onMatch = vi.fn();
    const d = new PromptDetector(onMatch);
    d.feed("admin@host's pass");
    d.feed('word: ');
    expect(onMatch).toHaveBeenCalledWith('login');
  });
});
