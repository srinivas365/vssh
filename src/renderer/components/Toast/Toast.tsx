import React, { useEffect } from 'react';
import { useSessionsStore } from '../../state/sessions-store';
import { PromptType } from '@shared/types';
import './Toast.css';

const label: Record<PromptType, string> = {
  login: 'Login password',
  sudo: 'Sudo password',
  'key-passphrase': 'Key passphrase',
  generic: 'Password',
};

function toastTitle(toast: { promptType: PromptType; hasSecret: boolean; delivery: 'copied' | 'sent' | 'none' }): string {
  if (!toast.hasSecret) return `No saved ${label[toast.promptType].toLowerCase()} for this host`;
  if (toast.delivery === 'sent') return `${label[toast.promptType]} sent`;
  return `${label[toast.promptType]} copied`;
}

function toastSubtext(toast: { hasSecret: boolean; delivery: 'copied' | 'sent' | 'none' }): string | null {
  if (!toast.hasSecret) return null;
  if (toast.delivery === 'sent') return 'Submitted automatically';
  return 'Press ⌘V to paste into the terminal';
}

export function ToastOverlay() {
  const { toasts, dismissToast } = useSessionsStore();
  const activeTabId = useSessionsStore((s) => s.activeTabId);
  const toast = toasts.find((t) => t.sessionId === activeTabId);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => dismissToast(toast.sessionId), 6000);
    return () => clearTimeout(id);
  }, [toast, dismissToast]);

  if (!toast) return null;

  return (
    <div className="toast">
      <div className="toast-title">
        <span className="toast-icon">🔑</span>
        {toastTitle(toast)}
      </div>
      {toastSubtext(toast) && <div className="toast-sub">{toastSubtext(toast)}</div>}
      <div className="toast-actions">
        <button onClick={() => dismissToast(toast.sessionId)}>Dismiss</button>
      </div>
    </div>
  );
}
