import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface Props {
  sessionId: string;
  active: boolean;
}

export function Terminal({ sessionId, active }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const term = new XTerm({
      fontFamily: 'Menlo, Monaco, monospace',
      fontSize: 13,
      theme: {
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
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(ref.current);
    fit.fit();
    xtermRef.current = term;
    fitRef.current = fit;

    term.onData((data) => { void window.api.session.input(sessionId, data); });
    term.onResize(({ cols, rows }) => { void window.api.session.resize(sessionId, cols, rows); });

    window.api.session.onOutput((sid, chunk) => {
      if (sid === sessionId) term.write(chunk);
    });

    const ro = new ResizeObserver(() => fit.fit());
    ro.observe(ref.current);

    return () => { ro.disconnect(); term.dispose(); xtermRef.current = null; };
  }, [sessionId]);

  useEffect(() => {
    if (active && fitRef.current) {
      requestAnimationFrame(() => fitRef.current?.fit());
      xtermRef.current?.focus();
    }
  }, [active]);

  return <div ref={ref} style={{ flex: 1, display: active ? 'block' : 'none' }} />;
}
