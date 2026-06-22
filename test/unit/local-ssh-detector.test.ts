import { describe, expect, it, vi } from 'vitest';
import { LocalSshOutputDetector } from '../../src/main/ssh/local-ssh-detector';

describe('LocalSshOutputDetector', () => {
  it('detects ssh login prompt and port from host-key message', () => {
    const onMatch = vi.fn();
    const detector = new LocalSshOutputDetector(onMatch, 4096, 0);

    detector.feed(
      "The authenticity of host '[10.60.112.21]:2233 ([10.60.112.21]:2233)' can't be established.\n",
    );
    detector.feed("ca_actionops@10.60.112.21's password: ");

    expect(onMatch).toHaveBeenCalledWith({
      username: 'ca_actionops',
      host: '10.60.112.21',
      port: 2233,
      keyPath: null,
    });
  });

  it('debounces duplicate prompt chunks for the same connection', () => {
    const onMatch = vi.fn();
    const detector = new LocalSshOutputDetector(onMatch, 4096, 2_000);

    const prompt = "ca_actionops@10.60.112.21's password: ";
    detector.feed(prompt);
    detector.feed(prompt);

    expect(onMatch).toHaveBeenCalledTimes(1);
  });

  it('fires again after a new ssh command resets the debounce', () => {
    const onMatch = vi.fn();
    const detector = new LocalSshOutputDetector(onMatch, 4096, 2_000);

    const prompt = "ca_actionops@10.60.112.21's password: ";
    detector.feed(prompt);
    detector.resetForNewCommand();
    detector.feed(prompt);

    expect(onMatch).toHaveBeenCalledTimes(2);
  });
});
