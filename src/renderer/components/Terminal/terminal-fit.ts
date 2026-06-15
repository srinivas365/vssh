import type { Terminal } from '@xterm/xterm';
import type { FitAddon } from '@xterm/addon-fit';

export const DEFAULT_PTY_COLS = 80;
export const DEFAULT_PTY_ROWS = 24;

let preferredPtyCols = DEFAULT_PTY_COLS;
let preferredPtyRows = DEFAULT_PTY_ROWS;

const syncedSizes = new Map<string, { cols: number; rows: number }>();

export function getPreferredPtySize(): { cols: number; rows: number } {
  return { cols: preferredPtyCols, rows: preferredPtyRows };
}

export function rememberPtySize(cols: number, rows: number): void {
  if (cols >= 2 && rows >= 2) {
    preferredPtyCols = cols;
    preferredPtyRows = rows;
  }
}

export function clearPtySync(sessionId: string): void {
  syncedSizes.delete(sessionId);
}

export function syncPtySize(term: Terminal, sessionId: string, force = false): void {
  const { cols, rows } = term;
  if (cols < 2 || rows < 2) return;

  const prev = syncedSizes.get(sessionId);
  if (!force && prev?.cols === cols && prev?.rows === rows) return;

  syncedSizes.set(sessionId, { cols, rows });
  rememberPtySize(cols, rows);
  void window.api.session.resize(sessionId, cols, rows);
}

/** Fit xterm to its container and keep the backing PTY grid in sync. */
export function fitAndSyncPty(
  term: Terminal,
  fit: FitAddon,
  sessionId: string,
  options: { force?: boolean } = {},
): boolean {
  const dims = fit.proposeDimensions();
  if (!dims?.cols || !dims?.rows || dims.cols < 2 || dims.rows < 2) return false;

  fit.fit();
  syncPtySize(term, sessionId, options.force);
  term.refresh(0, term.rows - 1);
  return true;
}

/** Retry fit until the container has measurable dimensions (e.g. first paint). */
export function scheduleFitUntilReady(
  term: Terminal,
  fit: FitAddon,
  sessionId: string,
  onReady?: () => void,
): () => void {
  let cancelled = false;
  let attempts = 0;

  const tryFit = (): void => {
    if (cancelled) return;
    const force = attempts === 0;
    if (fitAndSyncPty(term, fit, sessionId, { force })) {
      onReady?.();
      return;
    }
    if (++attempts < 12) requestAnimationFrame(tryFit);
  };

  requestAnimationFrame(tryFit);
  return () => { cancelled = true; };
}

export function debounce<T extends (...args: never[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return ((...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, ms);
  }) as T;
}
