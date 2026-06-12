import React, { useEffect, useRef, useState } from 'react';
import { Lock, Menu, RefreshCw, Terminal as TerminalIcon } from 'lucide-react';
import { Sidebar } from '../components/Sidebar/Sidebar';
import { TabBar } from '../components/TabBar/TabBar';
import { Terminal } from '../components/Terminal/Terminal';
import { ToastOverlay, TransferToastOverlay } from '../components/Toast/Toast';
import { VmEditForm } from '../components/VmEditForm/VmEditForm';
import { QuickConnect } from '../components/QuickConnect/QuickConnect';
import { HostsPage } from './HostsPage';
import { TransfersPage } from './TransfersPage';
import { SettingsPage } from './SettingsPage';
import { TransferWizard } from '../components/Transfers/TransferWizard';
import type { TransferDirection } from '@shared/types';
import { useSessionsStore } from '../state/sessions-store';
import { useUiStore } from '../state/ui-store';
import { useVaultStore } from '../state/vault-store';
import { useTransfersStore } from '../state/transfers-store';
import { reconnectTab } from '../connect-vm';
import { Vm } from '@shared/types';

type View = 'hosts' | 'terminal' | 'transfers' | 'settings';

export function Main() {
  const { tabs, activeTabId, updateState, pushToast, removeTab, addTab, replaceTabSession } = useSessionsStore();
  const [reconnecting, setReconnecting] = useState(false);
  const lock = useVaultStore((s) => s.lock);
  const [editing, setEditing] = useState<Vm | null | undefined>(undefined);
  const [cloning, setCloning] = useState<Vm | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const [view, setView] = useState<View>('hosts');
  const [transferWizard, setTransferWizard] = useState<{ vm: Vm; direction: TransferDirection } | null>(null);

  useEffect(() => {
    window.api.session.onState((s) => updateState(s));
    window.api.session.onToast((t) => pushToast(t));
  }, [updateState, pushToast]);

  // Auto-switch to terminal view when a new session is started, and back to
  // hosts when the last terminal closes.
  useEffect(() => {
    if (tabs.length === 0 && view === 'terminal') setView('hosts');
  }, [tabs.length, view]);

  // Jump to terminal when a new session tab is opened — not on every render.
  const prevTabCount = useRef(tabs.length);
  useEffect(() => {
    if (tabs.length > prevTabCount.current) setView('terminal');
    prevTabCount.current = tabs.length;
  }, [tabs.length]);

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

  const transfersStore = useTransfersStore();
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebarCollapsed = useUiStore((s) => s.toggleSidebarCollapsed);

  useEffect(() => {
    window.api.transfer.onState((record) => transfersStore.upsert(record));
    window.api.transfer.onProgress((progress) => transfersStore.applyProgress(progress));
    window.api.transfer.onLog((log) => transfersStore.pushLog(log));
    window.api.transfer.onToast((toast) => transfersStore.pushToast(toast));
  }, [transfersStore]);

  const activeTab = tabs.find((t) => t.sessionId === activeTabId);
  const canReconnect = activeTab?.state === 'closed' || activeTab?.state === 'error';

  async function handleReconnect() {
    if (!activeTab || reconnecting) return;
    setReconnecting(true);
    try {
      await reconnectTab(activeTab, replaceTabSession);
    } finally {
      setReconnecting(false);
    }
  }

  async function openLocalTerminal() {
    try {
      const sessionId = await window.api.session.startLocal(80, 24);
      addTab({ sessionId, vmId: null, label: 'Local', state: 'connected' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      window.alert(`Failed to start local terminal.\n\n${message}`);
    }
  }

  return (
    <div className="app-shell">
      <header className={`app-header${sidebarCollapsed ? ' app-header--sidebar-collapsed' : ''}`}>
        <div className="app-header-start">
          {sidebarCollapsed && (
            <button
              type="button"
              className="app-header-menu"
              onClick={toggleSidebarCollapsed}
              title="Show sidebar"
              aria-label="Show sidebar">
              <Menu size={16} strokeWidth={2} />
            </button>
          )}
          <div className="app-brand">
            <span className="app-brand-mark"><TerminalIcon size={13} strokeWidth={2.2} /></span>
            <span className="app-brand-name">vssh</span>
          </div>
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
          <button
            className={`nav-btn ${view === 'transfers' ? 'nav-btn-active' : ''}`}
            onClick={() => setView('transfers')}
            title="Transfers">
            Transfers
          </button>
        </nav>
        <div className="app-header-meta">
          {view === 'terminal' && activeTab ? (
            <>
              <span className="app-header-status">
                <span className={`app-header-dot dot-${activeTab.state}`} />
                {activeTab.label} · {activeTab.state}
              </span>
              {canReconnect && (
                <button
                  type="button"
                  className="app-header-reconnect"
                  onClick={() => void handleReconnect()}
                  disabled={reconnecting}
                  title="Reconnect session">
                  <RefreshCw size={12} strokeWidth={2.2} className={reconnecting ? 'spin' : undefined} />
                  {reconnecting ? 'Reconnecting…' : 'Reconnect'}
                </button>
              )}
            </>
          ) : (
            <span className="app-header-hint">⌘K to quick-connect · ⌘L to lock</span>
          )}
          <button className="app-header-lock" onClick={() => void lock()} title="Lock (⌘L)">
            <Lock size={14} />
          </button>
        </div>
      </header>

      <div className={`app-body${sidebarCollapsed ? ' app-body-sidebar-collapsed' : ''}`}>
        <Sidebar
          onNewVm={() => setEditing(null)}
          onEditVm={(vm) => setEditing(vm)}
          onCloneVm={(vm) => setCloning(vm)}
          onOpenSettings={() => setView('settings')}
          onOpenLocalTerminal={() => { void openLocalTerminal(); }}
        />
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
              <HostsPage
                onNewVm={() => setEditing(null)}
                onEditVm={(vm) => setEditing(vm)}
                onCloneVm={(vm) => setCloning(vm)}
                onUploadVm={(vm) => setTransferWizard({ vm, direction: 'upload' })}
                onDownloadVm={(vm) => setTransferWizard({ vm, direction: 'download' })}
              />
            </div>
            <div style={{ display: view === 'transfers' ? 'block' : 'none' }}>
              <TransfersPage />
            </div>
            <div className="app-view-layer" style={{ display: view === 'settings' ? 'block' : 'none' }}>
              <SettingsPage />
            </div>
          </div>
        </main>
      </div>

      {editing !== undefined && !cloning && <VmEditForm initial={editing} onClose={() => setEditing(undefined)} />}
      {cloning && <VmEditForm initial={null} cloneFrom={cloning} onClose={() => setCloning(null)} />}
      {quickOpen && <QuickConnect onClose={() => setQuickOpen(false)} />}
      {transferWizard && (
        <TransferWizard
          vm={transferWizard.vm}
          direction={transferWizard.direction}
          onClose={() => setTransferWizard(null)}
        />
      )}
      <ToastOverlay />
      <TransferToastOverlay />
    </div>
  );
}
