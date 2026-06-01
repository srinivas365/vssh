export function zeroBuffer(buf: Buffer): void {
  buf.fill(0);
}

export async function withZeroedBuffer<T>(buf: Buffer, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } finally {
    zeroBuffer(buf);
  }
}
