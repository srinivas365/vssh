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
        🔑 {toast.hasSecret ? `${label[toast.promptType]} copied` : `No saved ${label[toast.promptType].toLowerCase()} for this VM`}
      </div>
      {toast.hasSecret && <div className="toast-sub">Press ⌘V to paste</div>}
      <div className="toast-actions">
        <button onClick={() => dismissToast(toast.sessionId)}>Dismiss</button>
      </div>
    </div>
  );
}
