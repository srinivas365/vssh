import React, { useState } from 'react';
import { Terminal as TerminalIcon } from 'lucide-react';
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
      {/* Decorative background — pastel blobs + dot grid */}
      <div className="unlock-bg" aria-hidden>
        <div className="unlock-blob unlock-blob-1" />
        <div className="unlock-blob unlock-blob-2" />
        <div className="unlock-blob unlock-blob-3" />
        <div className="unlock-dots" />
      </div>

      <div className="unlock-stage">
        {/* Hero column with brand + decorative SVG illustration */}
        <div className="unlock-hero" aria-hidden>
          <div className="unlock-brand">
            <div className="unlock-brand-mark"><TerminalIcon size={26} strokeWidth={2.2} /></div>
            <div>
              <div className="unlock-brand-name">vssh</div>
              <div className="unlock-brand-tag">{isInit ? 'Encrypted SSH credential store' : 'Welcome back'}</div>
            </div>
          </div>

          <HeroIllustration />

          <div className="unlock-bullets">
            <div className="unlock-bullet">
              <span className="unlock-bullet-icon unlock-bullet-icon-1">🔒</span>
              <div>
                <div className="unlock-bullet-title">Local only</div>
                <div className="unlock-bullet-sub">Vault never leaves your Mac</div>
              </div>
            </div>
            <div className="unlock-bullet">
              <span className="unlock-bullet-icon unlock-bullet-icon-2">🔑</span>
              <div>
                <div className="unlock-bullet-title">AES-256 + Argon2id</div>
                <div className="unlock-bullet-sub">Hardened modern crypto</div>
              </div>
            </div>
            <div className="unlock-bullet">
              <span className="unlock-bullet-icon unlock-bullet-icon-3">⚡</span>
              <div>
                <div className="unlock-bullet-title">One paste away</div>
                <div className="unlock-bullet-sub">Passwords copied automatically</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right column form card */}
        <form onSubmit={submit} className="unlock-card">
          <div className="unlock-card-head">
            <h1 className="unlock-title">{isInit ? 'Create master password' : 'Unlock vault'}</h1>
            <p className="unlock-sub">
              {isInit
                ? 'This single password encrypts every saved host credential. There is no recovery — if you lose it, the vault is gone.'
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
        </form>
      </div>

      <style>{UNLOCK_CSS}</style>
    </div>
  );
}

function HeroIllustration() {
  return (
    <svg className="unlock-illu" viewBox="0 0 480 280" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="termGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff"/>
          <stop offset="100%" stopColor="#f8fafc"/>
        </linearGradient>
        <linearGradient id="serverGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#eef2ff"/>
          <stop offset="100%" stopColor="#e0e7ff"/>
        </linearGradient>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.0"/>
          <stop offset="50%" stopColor="#4f46e5" stopOpacity="0.9"/>
          <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0"/>
        </linearGradient>
      </defs>

      {/* Terminal window — left */}
      <g>
        <rect x="20" y="40" width="200" height="160" rx="14"
          fill="url(#termGrad)" stroke="#e2e8f0" strokeWidth="1.5"/>
        {/* title bar */}
        <rect x="20" y="40" width="200" height="28" rx="14" fill="#f1f5f9"/>
        <rect x="20" y="54" width="200" height="14" fill="#f1f5f9"/>
        <circle cx="36" cy="54" r="4" fill="#ef4444"/>
        <circle cx="50" cy="54" r="4" fill="#f59e0b"/>
        <circle cx="64" cy="54" r="4" fill="#10b981"/>
        {/* code lines */}
        <rect x="36" y="86"  width="14" height="6" rx="2" fill="#4f46e5"/>
        <rect x="56" y="86"  width="100" height="6" rx="2" fill="#cbd5e1"/>
        <rect x="36" y="104" width="14" height="6" rx="2" fill="#4f46e5"/>
        <rect x="56" y="104" width="78"  height="6" rx="2" fill="#cbd5e1"/>
        <rect x="36" y="122" width="14" height="6" rx="2" fill="#4f46e5"/>
        <rect x="56" y="122" width="120" height="6" rx="2" fill="#cbd5e1"/>
        <rect x="36" y="140" width="14" height="6" rx="2" fill="#10b981"/>
        <rect x="56" y="140" width="58"  height="6" rx="2" fill="#cbd5e1"/>
        {/* prompt line with cursor */}
        <rect x="36" y="170" width="6"  height="6" rx="1" fill="#4f46e5"/>
        <rect x="48" y="170" width="50" height="6" rx="2" fill="#94a3b8"/>
        <rect x="102" y="168" width="10" height="10" fill="#4f46e5">
          <animate attributeName="opacity" values="1;0;1" dur="1.2s" repeatCount="indefinite" />
        </rect>
      </g>

      {/* Connection line + lock badge */}
      <g>
        <path d="M 220 120 Q 250 80, 280 120 T 340 120"
          stroke="url(#lineGrad)" strokeWidth="2.5" fill="none" strokeDasharray="6 5"/>
        <circle cx="280" cy="96" r="20" fill="#ffffff" stroke="#e0e7ff" strokeWidth="2"/>
        <text x="280" y="103" textAnchor="middle" fontSize="16" fill="#4f46e5">🔒</text>
      </g>

      {/* Server stack — right */}
      <g transform="translate(340 50)">
        <rect x="0" y="0"  width="120" height="40" rx="8" fill="url(#serverGrad)" stroke="#c7d2fe" strokeWidth="1.5"/>
        <rect x="0" y="50" width="120" height="40" rx="8" fill="url(#serverGrad)" stroke="#c7d2fe" strokeWidth="1.5"/>
        <rect x="0" y="100" width="120" height="40" rx="8" fill="url(#serverGrad)" stroke="#c7d2fe" strokeWidth="1.5"/>
        {/* server LEDs */}
        <circle cx="14" cy="20"  r="3" fill="#10b981"/>
        <circle cx="14" cy="70"  r="3" fill="#10b981"/>
        <circle cx="14" cy="120" r="3" fill="#f59e0b"/>
        {/* rack lines */}
        <rect x="32" y="17" width="74" height="3" rx="1" fill="#a5b4fc"/>
        <rect x="32" y="24" width="50" height="3" rx="1" fill="#c7d2fe"/>
        <rect x="32" y="67" width="74" height="3" rx="1" fill="#a5b4fc"/>
        <rect x="32" y="74" width="60" height="3" rx="1" fill="#c7d2fe"/>
        <rect x="32" y="117" width="74" height="3" rx="1" fill="#a5b4fc"/>
        <rect x="32" y="124" width="40" height="3" rx="1" fill="#c7d2fe"/>
      </g>

      {/* Floating accent dots */}
      <circle cx="60" cy="20" r="4" fill="#a5b4fc" opacity="0.7"/>
      <circle cx="420" cy="220" r="5" fill="#fbcfe8" opacity="0.8"/>
      <circle cx="250" cy="240" r="3" fill="#67e8f9" opacity="0.7"/>
      <circle cx="160" cy="240" r="3" fill="#c4b5fd" opacity="0.7"/>
    </svg>
  );
}

const UNLOCK_CSS = `
.unlock-shell {
  position: relative;
  display: grid;
  place-items: center;
  height: 100vh;
  overflow: hidden;
  background: linear-gradient(180deg, #fafbff 0%, #f4f6fd 100%);
  font-family: inherit;
}

/* ── decorative background ─────────────────────────────────── */
.unlock-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}
.unlock-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.45;
}
.unlock-blob-1 {
  width: 460px; height: 460px;
  background: #c7d2fe;
  top: -160px; left: -120px;
}
.unlock-blob-2 {
  width: 380px; height: 380px;
  background: #a5f3fc;
  bottom: -140px; right: -80px;
  opacity: 0.4;
}
.unlock-blob-3 {
  width: 300px; height: 300px;
  background: #fbcfe8;
  top: 55%; left: 30%;
  opacity: 0.28;
}
.unlock-dots {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(circle, #cbd5e1 1px, transparent 1.5px);
  background-size: 28px 28px;
  mask-image: radial-gradient(ellipse at center, black 25%, transparent 70%);
  -webkit-mask-image: radial-gradient(ellipse at center, black 25%, transparent 70%);
  opacity: 0.55;
}

/* ── layout ─────────────────────────────────────────────── */
.unlock-stage {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 420px;
  gap: 56px;
  align-items: center;
  padding: 0 56px;
  max-width: 1080px;
  width: 100%;
}

/* ── hero (left) ────────────────────────────────────────── */
.unlock-hero {
  display: flex;
  flex-direction: column;
  gap: 28px;
}
.unlock-brand {
  display: flex;
  align-items: center;
  gap: 14px;
}
.unlock-brand-mark {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  background: linear-gradient(135deg, #6366f1, #4338ca);
  color: #fff;
  display: grid;
  place-items: center;
  font-size: 26px;
  font-weight: 700;
  box-shadow: 0 8px 24px rgba(79, 70, 229, 0.35);
}
.unlock-brand-name {
  font-size: 36px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1;
  color: var(--text);
}
.unlock-brand-tag {
  margin-top: 6px;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 500;
}

.unlock-illu {
  width: 100%;
  max-width: 480px;
  height: auto;
  filter: drop-shadow(0 12px 32px rgba(79, 70, 229, 0.12));
}

.unlock-bullets {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.unlock-bullet {
  display: flex;
  align-items: center;
  gap: 12px;
}
.unlock-bullet-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  font-size: 16px;
  flex-shrink: 0;
}
.unlock-bullet-icon-1 { background: #eef2ff; }
.unlock-bullet-icon-2 { background: #ecfeff; }
.unlock-bullet-icon-3 { background: #fef3c7; }
.unlock-bullet-title { font-size: 13px; font-weight: 600; color: var(--text); }
.unlock-bullet-sub   { font-size: 12px; color: var(--text-muted); margin-top: 1px; }

/* ── card (right) ───────────────────────────────────────── */
.unlock-card {
  width: 420px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  padding: 32px;
  border-radius: 16px;
  border: 1px solid rgba(226, 232, 240, 0.9);
  box-shadow:
    0 12px 40px rgba(15, 23, 42, 0.08),
    0 1px 0 rgba(255, 255, 255, 0.8) inset;
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

/* ── narrow window: stack ───────────────────────────────── */
@media (max-width: 920px) {
  .unlock-stage {
    grid-template-columns: 1fr;
    gap: 28px;
    padding: 32px 24px;
    max-width: 500px;
  }
  .unlock-hero { align-items: center; text-align: center; }
  .unlock-bullets { display: none; }
  .unlock-illu { max-width: 360px; }
  .unlock-card { width: 100%; }
}
`;
