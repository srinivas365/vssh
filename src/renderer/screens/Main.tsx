import React, { useEffect, useState } from 'react';
import { Sidebar } from '../components/Sidebar/Sidebar';
import { TabBar } from '../components/TabBar/TabBar';
import { Terminal } from '../components/Terminal/Terminal';
import { ToastOverlay } from '../components/Toast/Toast';
import { VmEditForm } from '../components/VmEditForm/VmEditForm';
import { QuickConnect } from '../components/QuickConnect/QuickConnect';
import { useSessionsStore } from '../state/sessions-store';
import { useVaultStore } from '../state/vault-store';
import { Vm } from '@shared/types';

export function Main() {
  const { tabs, activeTabId, updateState, pushToast, removeTab } = useSessionsStore();
  const lock = useVaultStore((s) => s.lock);
  const [editing, setEditing] = useState<Vm | null | undefined>(undefined);
  const [quickOpen, setQuickOpen] = useState(false);

  useEffect(() => {
    window.api.session.onState((s) => updateState(s));
    window.api.session.onToast((t) => pushToast(t));
  }, [updateState, pushToast]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === 'k') { e.preventDefault(); setQuickOpen(true); }
      else if (e.key === 'l' && !e.shiftKey) { e.preventDefault(); void lock(); }
      else if (e.key === 'w') {
        e.preventDefault();
        if (activeTabId) { void window.api.session.close(activeTabId); removeTab(activeTabId); }
      }
      else if (e.shiftKey && (e.key === 'P' || e.key === 'p')) {
        e.preventDefault();
        if (activeTabId) void window.api.session.pastePassword(activeTabId, 'login');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lock, activeTabId, removeTab]);

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#1e1e1e' }}>
      <Sidebar onNewVm={() => setEditing(null)} onEditVm={(vm) => setEditing(vm)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TabBar />
        <div style={{ flex: 1, position: 'relative' }}>
          {tabs.map((t) => (
            <Terminal key={t.sessionId} sessionId={t.sessionId} active={t.sessionId === activeTabId} />
          ))}
        </div>
      </div>
      {editing !== undefined && <VmEditForm initial={editing} onClose={() => setEditing(undefined)} />}
      {quickOpen && <QuickConnect onClose={() => setQuickOpen(false)} />}
      <ToastOverlay />
    </div>
  );
}
