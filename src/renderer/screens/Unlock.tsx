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
      <div className="unlock-bg" aria-hidden>
        <div className="unlock-bg-orb unlock-bg-orb-1" />
        <div className="unlock-bg-orb unlock-bg-orb-2" />
        <div className="unlock-bg-orb unlock-bg-orb-3" />
        <div className="unlock-bg-grid" />
      </div>

      <div className="unlock-stage">
        <div className="unlock-hero" aria-hidden>
          <div className="unlock-hero-mark">▸</div>
          <div className="unlock-hero-name">vssh</div>
          <div className="unlock-hero-tag">{isInit ? 'Encrypted SSH credential store' : 'Welcome back'}</div>
        </div>

        <form onSubmit={submit} className="unlock-card">
          <div className="unlock-card-head">
            <h1 className="unlock-title">{isInit ? 'Create master password' : 'Unlock vault'}</h1>
            <p className="unlock-sub">
              {isInit
                ? 'Protects every saved host credential with AES-256 encryption. There is no recovery — if you lose it, the vault is gone.'
                : 'Enter your master password to access saved hosts.'}
            </p>
          </div>

          <label className="unlock-field">
            <span className="unlock-field-label">Master password</span>
            <input
              type="password"
              value={pw}
              autoFocus
              placeholder={isInit ? 'At least 12 characters' : 'Enter password'}
              onChange={(e) => setPw(e.target.value)}
              disabled={busy}
              className="unlock-input"
            />
          </label>

          {isInit && (
            <label className="unlock-field">
              <span className="unlock-field-label">Confirm password</span>
              <input
                type="password"
                value={pw2}
                placeholder="Repeat the same password"
                onChange={(e) => setPw2(e.target.value)}
                disabled={busy}
                className="unlock-input"
              />
            </label>
          )}

          {err && <div className="unlock-err">{err}</div>}

          <button type="submit" disabled={busy || !pw} className="unlock-btn">
            {busy ? 'Working…' : isInit ? 'Create vault' : 'Unlock'}
          </button>

          {isInit && (
            <ul className="unlock-hints">
              <li><span className="unlock-hint-icon">🔒</span> Stored only on this Mac, never synced anywhere.</li>
              <li><span className="unlock-hint-icon">🔑</span> Argon2id-derived key, AES-256-GCM blob.</li>
              <li><span className="unlock-hint-icon">⚠️</span> No recovery — choose something you can remember.</li>
            </ul>
          )}
        </form>
      </div>

      <style>{`
        .unlock-shell {
          position: relative;
          display: grid;
          place-items: center;
          height: 100vh;
          overflow: hidden;
          font-family: inherit;
          background: radial-gradient(circle at 20% 0%, #6366f1 0%, #4338ca 45%, #312e81 100%);
        }

        /* Decorative background layers */
        .unlock-bg {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
        }
        .unlock-bg-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(70px);
          opacity: 0.55;
        }
        .unlock-bg-orb-1 {
          width: 520px; height: 520px;
          background: #8b5cf6;
          top: -180px; left: -120px;
        }
        .unlock-bg-orb-2 {
          width: 460px; height: 460px;
          background: #06b6d4;
          bottom: -160px; right: -100px;
          opacity: 0.45;
        }
        .unlock-bg-orb-3 {
          width: 360px; height: 360px;
          background: #f472b6;
          top: 60%; left: 40%;
          opacity: 0.25;
        }
        .unlock-bg-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: radial-gradient(ellipse at center, black 30%, transparent 75%);
          -webkit-mask-image: radial-gradient(ellipse at center, black 30%, transparent 75%);
        }

        .unlock-stage {
          position: relative;
          display: grid;
          grid-template-columns: 1fr 420px;
          gap: 64px;
          align-items: center;
          padding: 0 56px;
          max-width: 1040px;
          width: 100%;
        }

        /* Brand hero on the left */
        .unlock-hero {
          color: #fff;
          display: flex;
          flex-direction: column;
          gap: 14px;
          align-items: flex-start;
          user-select: none;
        }
        .unlock-hero-mark {
          width: 72px;
          height: 72px;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.16);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.25);
          display: grid;
          place-items: center;
          font-size: 32px;
          font-weight: 700;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
        }
        .unlock-hero-name {
          font-size: 56px;
          font-weight: 700;
          letter-spacing: -0.02em;
          line-height: 1;
        }
        .unlock-hero-tag {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.78);
          font-weight: 500;
          letter-spacing: 0.01em;
        }

        /* Card on the right */
        .unlock-card {
          width: 420px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          background: rgba(255, 255, 255, 0.97);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          padding: 32px;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.4);
          box-shadow:
            0 24px 60px rgba(15, 23, 42, 0.35),
            0 1px 0 rgba(255, 255, 255, 0.6) inset;
        }
        .unlock-card-head { margin-bottom: 4px; }
        .unlock-title {
          margin: 0;
          font-size: 22px;
          font-weight: 600;
          letter-spacing: -0.01em;
          color: var(--text);
        }
        .unlock-sub {
          margin: 8px 0 0 0;
          color: var(--text-muted);
          font-size: 13px;
          line-height: 1.55;
        }

        .unlock-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .unlock-field-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-faint);
        }
        .unlock-input {
          padding: 11px 14px;
          font-size: 14px;
          background: #ffffff;
          color: var(--text);
          border: 1px solid var(--border-strong);
          border-radius: 8px;
          font-family: inherit;
          transition: border-color 0.1s, box-shadow 0.1s;
        }
        .unlock-input:focus {
          outline: none;
          border-color: var(--accent);
          box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.18);
        }
        .unlock-input::placeholder { color: var(--text-faint); }

        .unlock-err {
          color: var(--danger);
          font-size: 12px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          padding: 9px 11px;
          border-radius: 8px;
          font-weight: 500;
        }
        .unlock-btn {
          padding: 12px;
          background: var(--accent);
          color: #ffffff;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          margin-top: 4px;
          transition: background 0.1s, transform 0.05s;
          box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35);
        }
        .unlock-btn:hover:not(:disabled) { background: var(--accent-hover); }
        .unlock-btn:active:not(:disabled) { transform: translateY(1px); }
        .unlock-btn:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }

        .unlock-hints {
          list-style: none;
          padding: 12px 0 0 0;
          margin: 4px 0 0 0;
          border-top: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 11.5px;
          color: var(--text-muted);
          line-height: 1.4;
        }
        .unlock-hints li { display: flex; align-items: flex-start; gap: 8px; }
        .unlock-hint-icon { flex-shrink: 0; }

        /* Narrow window: drop hero, center card */
        @media (max-width: 880px) {
          .unlock-stage {
            grid-template-columns: 1fr;
            gap: 32px;
            padding: 32px 24px;
            max-width: 480px;
          }
          .unlock-hero { align-items: center; text-align: center; }
          .unlock-hero-name { font-size: 36px; }
          .unlock-card { width: 100%; }
        }
      `}</style>
    </div>
  );
}
