import React from 'react';
import { X } from 'lucide-react';
import { useSessionsStore } from '../../state/sessions-store';
import './TabBar.css';

export function TabBar() {
  const { tabs, activeTabId, setActive, removeTab } = useSessionsStore();

  async function close(id: string) {
    await window.api.session.close(id);
    removeTab(id);
  }

  const stateColor = (s: string) =>
    s === 'connected' ? 'var(--success)' :
    s === 'connecting' ? 'var(--warn)' :
    s === 'error' || s === 'closed' ? 'var(--danger)' :
    'var(--text-faint)';

  if (tabs.length === 0) return null;

  return (
    <div className="tab-bar">
      {tabs.map((t) => (
        <div key={t.sessionId}
             className={`tab ${activeTabId === t.sessionId ? 'active' : ''}`}
             onClick={() => setActive(t.sessionId)}>
          <span className="tab-dot" style={{ background: stateColor(t.state) }} />
          <span className="tab-label">{t.label}</span>
          <button className="tab-close" onClick={(e) => { e.stopPropagation(); close(t.sessionId); }} aria-label="Close tab">
            <X size={12} strokeWidth={2.2} />
          </button>
        </div>
      ))}
    </div>
  );
}
