import React, { useEffect, useState } from 'react';
import { Sidebar } from '../components/Sidebar/Sidebar';
import { TabBar } from '../components/TabBar/TabBar';
import { Terminal } from '../components/Terminal/Terminal';
import { ToastOverlay } from '../components/Toast/Toast';
import { VmEditForm } from '../components/VmEditForm/VmEditForm';
import { QuickConnect } from '../components/QuickConnect/QuickConnect';
import { HostsPage } from './HostsPage';
import { useSessionsStore } from '../state/sessions-store';
import { useVaultStore } from '../state/vault-store';
import { Vm } from '@shared/types';

type View = 'hosts' | 'terminal';

export function Main() {
  const { tabs, activeTabId, updateState, pushToast, removeTab, addTab } = useSessionsStore();
  const lock = useVaultStore((s) => s.lock);
  const [editing, setEditing] = useState<Vm | null | undefined>(undefined);
  const [quickOpen, setQuickOpen] = useState(false);
  const [view, setView] = useState<View>('hosts');

  useEffect(() => {
    window.api.session.onState((s) => updateState(s));
    window.api.session.onToast((t) => pushToast(t));
  }, [updateState, pushToast]);

  // Auto-switch to terminal view when a new session is started, and back to
  // hosts when the last terminal closes.
  useEffect(() => {
    if (tabs.length === 0 && view === 'terminal') setView('hosts');
  }, [tabs.length, view]);

  // Subscribe to new-tab events from anywhere (sidebar, quick-connect, hosts page).
  useEffect(() => {
    const prev = addTab;
    // We can't intercept; instead, watch activeTabId — when it changes to a new value, jump to terminal view.
  }, [addTab]);
  useEffect(() => {
    if (activeTabId) setView('terminal');
  }, [activeTabId]);

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
      else if (e.key === '1' && !e.shiftKey) { e.preventDefault(); setView('hosts'); }
      else if (e.key === '2' && !e.shiftKey && tabs.length > 0) { e.preventDefault(); setView('terminal'); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lock, activeTabId, removeTab, tabs.length]);

  const activeTab = tabs.find((t) => t.sessionId === activeTabId);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-brand">
          <span className="app-brand-mark">▸</span>
          <span className="app-brand-name">vssh</span>
        </div>
        <nav className="app-nav">
          <button
            className={`nav-btn ${view === 'hosts' ? 'nav-btn-active' : ''}`}
            onClick={() => setView('hosts')}
            title="Hosts (⌘1)">
            Hosts
          </button>
          <button
            className={`nav-btn ${view === 'terminal' ? 'nav-btn-active' : ''}`}
            onClick={() => setView('terminal')}
            disabled={tabs.length === 0}
            title="Terminal (⌘2)">
            Terminal {tabs.length > 0 && <span className="nav-btn-badge">{tabs.length}</span>}
          </button>
        </nav>
        <div className="app-header-meta">
          {view === 'terminal' && activeTab ? (
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
          <div
            style={{
              display: view === 'terminal' ? 'block' : 'none',
              flexShrink: 0,
            }}>
            <TabBar />
          </div>
          <div className="terminal-stack">
            {/* Terminals stay mounted so xterm scrollback survives view switches. */}
            {tabs.map((t) => (
              <Terminal
                key={t.sessionId}
                sessionId={t.sessionId}
                active={view === 'terminal' && t.sessionId === activeTabId}
              />
            ))}
            {/* Hosts page overlays the terminal stack when active. */}
            <div style={{ display: view === 'hosts' ? 'block' : 'none' }}>
              <HostsPage onNewVm={() => setEditing(null)} onEditVm={(vm) => setEditing(vm)} />
            </div>
          </div>
        </main>
      </div>

      {editing !== undefined && <VmEditForm initial={editing} onClose={() => setEditing(undefined)} />}
      {quickOpen && <QuickConnect onClose={() => setQuickOpen(false)} />}
      <ToastOverlay />
    </div>
  );
}
