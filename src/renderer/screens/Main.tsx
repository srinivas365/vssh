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

  const activeTab = tabs.find((t) => t.sessionId === activeTabId);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-brand">
          <span className="app-brand-mark">▸</span>
          <span className="app-brand-name">vssh</span>
        </div>
        <div className="app-header-meta">
          {activeTab ? (
            <span className="app-header-status">
              <span className={`app-header-dot dot-${activeTab.state}`} />
              {activeTab.label} · {activeTab.state}
            </span>
          ) : (
            <span className="app-header-hint">⌘K to quick-connect · ⌘L to lock</span>
          )}
          <button className="app-header-lock" onClick={() => void lock()} title="Lock (⌘L)">
            🔒
          </button>
        </div>
      </header>

      <div className="app-body">
        <Sidebar onNewVm={() => setEditing(null)} onEditVm={(vm) => setEditing(vm)} />
        <main className="app-main">
          <TabBar />
          <div className="terminal-stack">
            {tabs.length === 0 ? (
              <EmptyState onQuickConnect={() => setQuickOpen(true)} onNewVm={() => setEditing(null)} />
            ) : (
              tabs.map((t) => (
                <Terminal key={t.sessionId} sessionId={t.sessionId} active={t.sessionId === activeTabId} />
              ))
            )}
          </div>
        </main>
      </div>

      {editing !== undefined && <VmEditForm initial={editing} onClose={() => setEditing(undefined)} />}
      {quickOpen && <QuickConnect onClose={() => setQuickOpen(false)} />}
      <ToastOverlay />
    </div>
  );
}

function EmptyState({ onQuickConnect, onNewVm }: { onQuickConnect: () => void; onNewVm: () => void }) {
  return (
    <div className="empty-state">
      <div className="empty-state-mark">▸</div>
      <h1 className="empty-state-title">No active session</h1>
      <p className="empty-state-sub">
        Open a saved host from the sidebar, jump to one with <kbd>⌘K</kbd>, or add a new one.
      </p>
      <div className="empty-state-actions">
        <button className="btn btn-primary" onClick={onQuickConnect}>Quick connect</button>
        <button className="btn" onClick={onNewVm}>+ New host</button>
      </div>
    </div>
  );
}
