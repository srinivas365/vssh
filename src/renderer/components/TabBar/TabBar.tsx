import React from 'react';
import { useSessionsStore } from '../../state/sessions-store';
import './TabBar.css';

export function TabBar() {
  const { tabs, activeTabId, setActive, removeTab } = useSessionsStore();

  async function close(id: string) {
    await window.api.session.close(id);
    removeTab(id);
  }

  const stateColor = (s: string) =>
    s === 'connected' ? '#5cb85c' : s === 'connecting' ? '#f0ad4e' : s === 'error' || s === 'closed' ? '#d9534f' : '#888';

  return (
    <div className="tab-bar">
      {tabs.map((t) => (
        <div key={t.sessionId}
             className={`tab ${activeTabId === t.sessionId ? 'active' : ''}`}
             onClick={() => setActive(t.sessionId)}>
          <span className="tab-dot" style={{ background: stateColor(t.state) }} />
          <span className="tab-label">{t.label}</span>
          <button className="tab-close" onClick={(e) => { e.stopPropagation(); close(t.sessionId); }}>×</button>
        </div>
      ))}
    </div>
  );
}
