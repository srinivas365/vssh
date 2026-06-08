import React, { useEffect } from 'react';
import { ArrowUpDown, KeyRound } from 'lucide-react';
import { useSessionsStore } from '../../state/sessions-store';
import { useTransfersStore } from '../../state/transfers-store';
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

function pasteHint(): string {
  const isWindows = navigator.platform.toLowerCase().includes('win')
    || navigator.userAgent.toLowerCase().includes('windows');
  return isWindows
    ? 'Press Ctrl+V to paste into the terminal'
    : 'Press ⌘V to paste into the terminal';
}

function toastSubtext(toast: { hasSecret: boolean; delivery: 'copied' | 'sent' | 'none' }): string | null {
  if (!toast.hasSecret) return null;
  if (toast.delivery === 'sent') return 'Submitted automatically';
  return pasteHint();
}

export function TransferToastOverlay() {
  const { toasts, dismissToast } = useTransfersStore();
  const toast = toasts[toasts.length - 1] ?? null;

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => dismissToast(toast.id), 4000);
    return () => clearTimeout(id);
  }, [toast, dismissToast]);

  if (!toast) return null;

  const title =
    toast.status === 'succeeded' ? 'Transfer complete' :
    toast.status === 'failed' ? 'Transfer failed' :
    toast.message;

  return (
    <div className="toast transfer-toast">
      <div className="toast-title">
        <span className="toast-icon"><ArrowUpDown size={14} strokeWidth={2} /></span>
        {title}
      </div>
      {toast.status === 'failed' && toast.message && (
        <div className="toast-sub">{toast.message}</div>
      )}
      <div className="toast-actions">
        <button onClick={() => dismissToast(toast.id)}>Dismiss</button>
      </div>
    </div>
  );
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
        <span className="toast-icon"><KeyRound size={14} strokeWidth={2} /></span>
        {toastTitle(toast)}
      </div>
      {toastSubtext(toast) && <div className="toast-sub">{toastSubtext(toast)}</div>}
      <div className="toast-actions">
        <button onClick={() => dismissToast(toast.sessionId)}>Dismiss</button>
      </div>
    </div>
  );
}
