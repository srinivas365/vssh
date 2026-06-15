import type { Terminal } from '@xterm/xterm';

export interface TerminalOutputWriter {
  (chunk: string): void;
  dispose: () => void;
}

/** Queue PTY output so bursty pipe output does not garble xterm rendering. */
export function createTerminalOutputWriter(term: Terminal): TerminalOutputWriter {
  const queue: string[] = [];
  let draining = false;
  let disposed = false;

  function drain(): void {
    if (disposed || draining || queue.length === 0) return;
    draining = true;
    const chunk = queue.shift()!;
    term.write(chunk, () => {
      draining = false;
      drain();
    });
  }

  const write: TerminalOutputWriter = (chunk: string) => {
    if (disposed) return;
    queue.push(chunk);
    drain();
  };

  write.dispose = () => {
    disposed = true;
    queue.length = 0;
  };

  return write;
}
