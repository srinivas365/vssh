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
    const term = new XTerm({ fontFamily: 'Menlo, Monaco, monospace', fontSize: 13, theme: { background: '#1e1e1e' } });
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
