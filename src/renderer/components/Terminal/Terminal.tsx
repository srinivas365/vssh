import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm, ITheme } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import type { ThemeName } from '@shared/types';
import { useSettingsStore } from '../../state/settings-store';
import { attachTerminalClipboard } from './terminal-clipboard';
import {
  clearPtySync,
  debounce,
  fitAndSyncPty,
  scheduleFitUntilReady,
  syncPtySize,
} from './terminal-fit';
import { createTerminalOutputWriter } from './terminal-output';

interface Props {
  sessionId: string;
  /** Whether this tab is the selected terminal tab. */
  isActiveTab: boolean;
  /** Whether the terminal view layer is visible (not hosts/settings/etc.). */
  terminalViewVisible: boolean;
}

const TERMINAL_THEMES: Record<ThemeName, ITheme> = {
  light: {
    background: '#ffffff',
    foreground: '#1a1a1a',
    cursor: '#1a1a1a',
    cursorAccent: '#ffffff',
    selectionBackground: '#bfdbfe',
    black: '#1a1a1a',
    red: '#dc2626',
    green: '#16a34a',
    yellow: '#ca8a04',
    blue: '#2563eb',
    magenta: '#9333ea',
    cyan: '#0891b2',
    white: '#f5f5f5',
    brightBlack: '#6b7280',
    brightRed: '#ef4444',
    brightGreen: '#22c55e',
    brightYellow: '#eab308',
    brightBlue: '#3b82f6',
    brightMagenta: '#a855f7',
    brightCyan: '#06b6d4',
    brightWhite: '#ffffff',
  },
  dark: {
    background: '#0a1322',
    foreground: '#dbe4f0',
    cursor: '#dbe4f0',
    cursorAccent: '#0a1322',
    selectionBackground: '#334155',
    black: '#111827',
    red: '#f87171',
    green: '#34d399',
    yellow: '#fbbf24',
    blue: '#60a5fa',
    magenta: '#c084fc',
    cyan: '#22d3ee',
    white: '#e5e7eb',
    brightBlack: '#64748b',
    brightRed: '#fca5a5',
    brightGreen: '#6ee7b7',
    brightYellow: '#fcd34d',
    brightBlue: '#93c5fd',
    brightMagenta: '#d8b4fe',
    brightCyan: '#67e8f9',
    brightWhite: '#f8fafc',
  },
  claude: {
    background: '#fefaf2',
    foreground: '#2d2418',
    cursor: '#2d2418',
    cursorAccent: '#fefaf2',
    selectionBackground: '#e5d6bd',
    black: '#3c3023',
    red: '#c0563a',
    green: '#2f855a',
    yellow: '#b7791f',
    blue: '#2b6cb0',
    magenta: '#805ad5',
    cyan: '#2c7a7b',
    white: '#f3eadb',
    brightBlack: '#8b7a60',
    brightRed: '#dd6b4d',
    brightGreen: '#38a169',
    brightYellow: '#d69e2e',
    brightBlue: '#3182ce',
    brightMagenta: '#9f7aea',
    brightCyan: '#319795',
    brightWhite: '#fffaf1',
  },
  dracula: {
    background: '#282a36',
    foreground: '#f8f8f2',
    cursor: '#f8f8f2',
    cursorAccent: '#282a36',
    selectionBackground: '#44475a',
    black: '#21222c',
    red: '#ff5555',
    green: '#50fa7b',
    yellow: '#f1fa8c',
    blue: '#bd93f9',
    magenta: '#ff79c6',
    cyan: '#8be9fd',
    white: '#f8f8f2',
    brightBlack: '#6272a4',
    brightRed: '#ff6e6e',
    brightGreen: '#69ff94',
    brightYellow: '#ffffa5',
    brightBlue: '#d6acff',
    brightMagenta: '#ff92df',
    brightCyan: '#a4ffff',
    brightWhite: '#ffffff',
  },
  nord: {
    background: '#2e3440',
    foreground: '#d8dee9',
    cursor: '#d8dee9',
    cursorAccent: '#2e3440',
    selectionBackground: '#434c5e',
    black: '#3b4252',
    red: '#bf616a',
    green: '#a3be8c',
    yellow: '#ebcb8b',
    blue: '#81a1c1',
    magenta: '#b48ead',
    cyan: '#88c0d0',
    white: '#e5e9f0',
    brightBlack: '#4c566a',
    brightRed: '#d08770',
    brightGreen: '#a3be8c',
    brightYellow: '#ebcb8b',
    brightBlue: '#81a1c1',
    brightMagenta: '#b48ead',
    brightCyan: '#8fbcbb',
    brightWhite: '#eceff4',
  },
  'solarized-dark': {
    background: '#002b36',
    foreground: '#839496',
    cursor: '#93a1a1',
    cursorAccent: '#002b36',
    selectionBackground: '#073642',
    black: '#073642',
    red: '#dc322f',
    green: '#859900',
    yellow: '#b58900',
    blue: '#268bd2',
    magenta: '#d33682',
    cyan: '#2aa198',
    white: '#eee8d5',
    brightBlack: '#586e75',
    brightRed: '#cb4b16',
    brightGreen: '#586e75',
    brightYellow: '#657b83',
    brightBlue: '#839496',
    brightMagenta: '#6c71c4',
    brightCyan: '#93a1a1',
    brightWhite: '#fdf6e3',
  },
};

function resolveTerminalTheme(theme: ThemeName): ITheme {
  return TERMINAL_THEMES[theme] ?? TERMINAL_THEMES.light;
}

export function Terminal({ sessionId, isActiveTab, terminalViewVisible }: Props) {
  const shellRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const focusedRef = useRef(isActiveTab && terminalViewVisible);
  const settings = useSettingsStore((s) => s.settings);
  const focused = isActiveTab && terminalViewVisible;

  useEffect(() => {
    focusedRef.current = focused;
  }, [focused]);

  useEffect(() => {
    if (!mountRef.current || !shellRef.current) return;
    const term = new XTerm({
      fontFamily: settings.terminalFontFamily,
      fontSize: settings.terminalFontSize,
      theme: resolveTerminalTheme(settings.theme),
      scrollback: 5000,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(mountRef.current);
    attachTerminalClipboard(term);
    xtermRef.current = term;
    fitRef.current = fit;

    term.onData((data) => { void window.api.session.input(sessionId, data); });
    term.onResize(({ cols, rows }) => {
      syncPtySize(term, sessionId);
      term.refresh(0, rows - 1);
    });

    const writeOutput = createTerminalOutputWriter(term);
    const unsubscribeOutput = window.api.session.onOutput((sid, chunk) => {
      if (sid === sessionId) writeOutput(chunk);
    });

    const fitTerminal = (force = false) => fitAndSyncPty(term, fit, sessionId, { force });
    const cancelInitialFit = scheduleFitUntilReady(term, fit, sessionId);

    const debouncedFit = debounce(() => fitTerminal(false), 50);
    const ro = new ResizeObserver(() => debouncedFit());
    ro.observe(shellRef.current);

    const onWindowResize = debounce(() => fitTerminal(false), 100);
    window.addEventListener('resize', onWindowResize);

    return () => {
      cancelInitialFit();
      ro.disconnect();
      window.removeEventListener('resize', onWindowResize);
      unsubscribeOutput();
      writeOutput.dispose();
      clearPtySync(sessionId);
      term.dispose();
      xtermRef.current = null;
      fitRef.current = null;
    };
  }, [sessionId]);

  useEffect(() => {
    if (!xtermRef.current || !fitRef.current) return;
    xtermRef.current.options.fontFamily = settings.terminalFontFamily;
    xtermRef.current.options.fontSize = settings.terminalFontSize;
    xtermRef.current.options.theme = resolveTerminalTheme(settings.theme);
    fitAndSyncPty(xtermRef.current, fitRef.current, sessionId, { force: true });
  }, [settings, sessionId]);

  useEffect(() => {
    if (!focused || !fitRef.current || !xtermRef.current) return;
    requestAnimationFrame(() => {
      if (!fitRef.current || !xtermRef.current) return;
      fitAndSyncPty(xtermRef.current, fitRef.current, sessionId, { force: true });
      xtermRef.current.focus();
    });
  }, [focused, sessionId]);

  return (
    <div
      ref={shellRef}
      style={{
        position: 'absolute',
        inset: 0,
        padding: 8,
        background: resolveTerminalTheme(settings.theme).background,
        // Keep layout size when hidden so fit/PTY stay aligned across tab/view switches.
        visibility: focused ? 'visible' : 'hidden',
        pointerEvents: focused ? 'auto' : 'none',
        zIndex: isActiveTab ? 1 : 0,
      }}
    >
      {/* FitAddon measures the mount element's client size; padding must live on a parent. */}
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
