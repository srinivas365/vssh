import React, { useEffect, useState } from 'react';
import { Sidebar } from '../components/Sidebar/Sidebar';
import { TabBar } from '../components/TabBar/TabBar';
import { Terminal } from '../components/Terminal/Terminal';
import { ToastOverlay } from '../components/Toast/Toast';
import { VmEditForm } from '../components/VmEditForm/VmEditForm';
import { useSessionsStore } from '../state/sessions-store';
import { Vm } from '@shared/types';

export function Main() {
  const { tabs, activeTabId, updateState, pushToast } = useSessionsStore();
  const [editing, setEditing] = useState<Vm | null | undefined>(undefined);

  useEffect(() => {
    window.api.session.onState((s) => updateState(s));
    window.api.session.onToast((t) => pushToast(t));
  }, [updateState, pushToast]);

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
      <ToastOverlay />
    </div>
  );
}
