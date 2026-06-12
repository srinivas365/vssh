import React, { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Search, Trash2, UserRound } from 'lucide-react';
import { useIdentitiesStore } from '../state/identities-store';
import type { Identity } from '@shared/types';
import { IdentityEditForm } from '../components/IdentityEditForm/IdentityEditForm';
import './IdentitiesPage.css';

export function IdentitiesPage() {
  const { identities, refresh, remove } = useIdentitiesStore();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Identity | null | undefined>(undefined);

  useEffect(() => { void refresh(); }, [refresh]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return identities;
    return identities.filter(
      (i) => i.label.toLowerCase().includes(q) || i.username.toLowerCase().includes(q),
    );
  }, [identities, query]);

  async function handleDelete(identity: Identity) {
    if (!window.confirm(`Delete identity "${identity.label}"?`)) return;
    await remove(identity.id);
  }

  return (
    <div className="identities-page">
      <header className="identities-header">
        <div>
          <h1 className="identities-title">Identities</h1>
          <p className="identities-sub">
            Reusable login and sudo credentials for filling host details quickly.
          </p>
        </div>
        <div className="identities-header-actions">
          <div className="identities-search-wrap">
            <span className="identities-search-icon"><Search size={14} /></span>
            <input
              className="identities-search"
              placeholder="Search identities…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" type="button" onClick={() => setEditing(null)}>
            <Plus size={14} strokeWidth={2.2} /> New identity
          </button>
        </div>
      </header>

      {filtered.length === 0 ? (
        <div className="identities-empty">
          <UserRound size={32} strokeWidth={1.5} />
          <p>{identities.length === 0 ? 'No identities yet.' : 'No identities match your search.'}</p>
          {identities.length === 0 && (
            <button className="btn btn-primary" type="button" onClick={() => setEditing(null)}>
              <Plus size={14} /> Create your first identity
            </button>
          )}
        </div>
      ) : (
        <ul className="identities-list">
          {filtered.map((identity) => (
            <li key={identity.id} className="identities-card">
              <div className="identities-card-main">
                <span className="identities-card-icon"><UserRound size={16} strokeWidth={2} /></span>
                <div>
                  <div className="identities-card-label">{identity.label}</div>
                  <div className="identities-card-user">{identity.username}</div>
                </div>
              </div>
              <div className="identities-card-actions">
                <button
                  type="button"
                  className="identities-icon-btn"
                  title="Edit"
                  onClick={() => setEditing(identity)}>
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  className="identities-icon-btn identities-icon-btn-danger"
                  title="Delete"
                  onClick={() => { void handleDelete(identity); }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing !== undefined && (
        <IdentityEditForm initial={editing} onClose={() => setEditing(undefined)} />
      )}
    </div>
  );
}
