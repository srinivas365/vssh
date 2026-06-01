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
    <div className="unlock-shell">
      <form onSubmit={submit} className="unlock-card">
        <div className="unlock-brand">
          <div className="unlock-brand-mark">▸</div>
          <div className="unlock-brand-name">vssh</div>
        </div>
        <h1 className="unlock-title">{isInit ? 'Create master password' : 'Unlock vault'}</h1>
        <p className="unlock-sub">
          {isInit
            ? 'This password encrypts your saved host credentials. There is no recovery — if you lose it, the vault is gone.'
            : 'Enter your master password to access saved hosts.'}
        </p>
        <input
          type="password"
          value={pw}
          autoFocus
          placeholder="Master password"
          onChange={(e) => setPw(e.target.value)}
          disabled={busy}
          className="unlock-input"
        />
        {isInit && (
          <input
            type="password"
            value={pw2}
            placeholder="Confirm password"
            onChange={(e) => setPw2(e.target.value)}
            disabled={busy}
            className="unlock-input"
          />
        )}
        {err && <div className="unlock-err">{err}</div>}
        <button type="submit" disabled={busy || !pw} className="unlock-btn">
          {isInit ? 'Create vault' : 'Unlock'}
        </button>
      </form>
      <style>{`
        .unlock-shell {
          display: grid;
          place-items: center;
          height: 100vh;
          background: linear-gradient(180deg, #f1f5f9 0%, #f8fafc 100%);
          font-family: inherit;
        }
        .unlock-card {
          width: 380px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          background: #ffffff;
          padding: 28px;
          border-radius: 14px;
          border: 1px solid var(--border);
          box-shadow: 0 8px 32px rgba(15, 23, 42, 0.08);
        }
        .unlock-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 8px;
        }
        .unlock-brand-mark {
          width: 32px;
          height: 32px;
          background: var(--accent);
          color: #fff;
          border-radius: 8px;
          display: grid;
          place-items: center;
          font-weight: 700;
          font-size: 16px;
        }
        .unlock-brand-name { font-weight: 700; font-size: 18px; }
        .unlock-title { margin: 0; font-size: 22px; font-weight: 600; }
        .unlock-sub { margin: 0; color: var(--text-muted); font-size: 13px; line-height: 1.5; }
        .unlock-input {
          padding: 10px 12px;
          font-size: 14px;
          background: #ffffff;
          color: var(--text);
          border: 1px solid var(--border-strong);
          border-radius: 6px;
          font-family: inherit;
          transition: border-color 0.1s, box-shadow 0.1s;
        }
        .unlock-input:focus {
          outline: none;
          border-color: var(--accent);
          box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15);
        }
        .unlock-err {
          color: var(--danger);
          font-size: 12px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          padding: 8px 10px;
          border-radius: 6px;
        }
        .unlock-btn {
          padding: 10px;
          background: var(--accent);
          color: #ffffff;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          margin-top: 4px;
          transition: background 0.1s;
        }
        .unlock-btn:hover:not(:disabled) { background: var(--accent-hover); }
        .unlock-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
