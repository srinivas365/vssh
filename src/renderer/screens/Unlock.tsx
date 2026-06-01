import React, { useState } from 'react';
import { useVaultStore } from '../state/vault-store';

export function Unlock() {
  const state = useVaultStore((s) => s.state);
  const init = useVaultStore((s) => s.init);
  const unlock = useVaultStore((s) => s.unlock);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isInit = state === 'empty';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (isInit) {
        if (pw.length < 12) { setErr('Master password must be at least 12 characters.'); return; }
        if (pw !== pw2) { setErr('Passwords do not match.'); return; }
        await init(pw);
      } else {
        try {
          await unlock(pw);
        } catch {
          setErr('Incorrect password.');
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    } finally {
      setBusy(false);
      setPw(''); setPw2('');
    }
  }

  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100vh', fontFamily: 'system-ui', background: '#f5f5f5', color: '#1a1a1a' }}>
      <form onSubmit={submit} style={{ width: 360, display: 'flex', flexDirection: 'column', gap: 12, background: '#ffffff', padding: 24, borderRadius: 8, border: '1px solid #e5e5e5', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>{isInit ? 'Create master password' : 'Unlock'}</h1>
        {isInit && (
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
            This password encrypts your saved VM credentials. There is no recovery — if you lose it, the vault is gone.
          </p>
        )}
        <input
          type="password"
          value={pw}
          autoFocus
          placeholder="master password"
          onChange={(e) => setPw(e.target.value)}
          disabled={busy}
          style={{ padding: 8, fontSize: 14, background: '#ffffff', color: '#1a1a1a', border: '1px solid #d4d4d4', borderRadius: 4 }}
        />
        {isInit && (
          <input
            type="password"
            value={pw2}
            placeholder="confirm"
            onChange={(e) => setPw2(e.target.value)}
            disabled={busy}
            style={{ padding: 8, fontSize: 14, background: '#ffffff', color: '#1a1a1a', border: '1px solid #d4d4d4', borderRadius: 4 }}
          />
        )}
        {err && <div style={{ color: '#dc2626', fontSize: 13 }}>{err}</div>}
        <button type="submit" disabled={busy || !pw} style={{ padding: 8, background: '#3b82f6', color: '#ffffff', border: 'none', borderRadius: 4, cursor: busy || !pw ? 'not-allowed' : 'pointer', opacity: busy || !pw ? 0.5 : 1 }}>
          {isInit ? 'Create vault' : 'Unlock'}
        </button>
      </form>
    </div>
  );
}
