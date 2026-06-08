import React, { useMemo, useState } from 'react';
import type { Folder, Vm } from '@shared/types';
import { MIN_EXPORT_KEY_LEN } from '@shared/hosts-export';
import {
  countExportHosts,
  defaultExportSelection,
  workspaceHostCounts,
} from '@shared/hosts-export-selection';
import './HostsTransferModal.css';

type Mode = 'export' | 'import';

interface Props {
  mode: Mode;
  folders: Folder[];
  vms: Vm[];
  onClose: () => void;
  onComplete: (message: string) => void;
}

function errorMessage(error: unknown): string {
  const msg = error instanceof Error ? error.message : '';
  if (msg === 'export-key-too-short') return `Export key must be at least ${MIN_EXPORT_KEY_LEN} characters.`;
  if (msg === 'export-empty') return 'Select at least one workspace with hosts to export.';
  if (msg === 'invalid-export-key') return 'Wrong export key or corrupted export file.';
  if (msg === 'invalid-export-file') return 'This file is not a valid vssh export.';
  if (msg === 'vault-locked') return 'Unlock the vault before exporting or importing hosts.';
  return 'Export/import failed. Try again.';
}

export function HostsTransferModal({ mode, folders, vms, onClose, onComplete }: Props) {
  const defaults = useMemo(() => defaultExportSelection(folders, vms), [folders, vms]);
  const hostCounts = useMemo(() => workspaceHostCounts(folders, vms), [folders, vms]);
  const unassignedCount = hostCounts.get(null) ?? 0;

  const [exportKey, setExportKey] = useState('');
  const [confirmKey, setConfirmKey] = useState('');
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<number>>(
    () => new Set(defaults.folderIds),
  );
  const [includeUnassigned, setIncludeUnassigned] = useState(defaults.includeUnassigned);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isExport = mode === 'export';
  const keysMatch = !isExport || exportKey === confirmKey;
  const longEnough = exportKey.length >= MIN_EXPORT_KEY_LEN;
  const selection = useMemo(
    () => ({ folderIds: [...selectedFolderIds], includeUnassigned }),
    [selectedFolderIds, includeUnassigned],
  );
  const selectedHostCount = useMemo(() => countExportHosts(vms, selection), [vms, selection]);
  const canSubmit = longEnough && keysMatch && !busy && (!isExport || selectedHostCount > 0);

  function toggleFolder(folderId: number) {
    setSelectedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }

  function selectAllWorkspaces() {
    setSelectedFolderIds(new Set(folders.map((f) => f.id)));
    setIncludeUnassigned(unassignedCount > 0);
  }

  function deselectAllWorkspaces() {
    setSelectedFolderIds(new Set());
    setIncludeUnassigned(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      if (isExport) {
        const result = await window.api.hosts.export({
          exportKey,
          folderIds: selection.folderIds,
          includeUnassigned: selection.includeUnassigned,
        });
        if (result.cancelled) {
          onClose();
          return;
        }
        onComplete(`Exported ${result.hostCount ?? selectedHostCount} host(s) to ${result.path ?? 'file'}.`);
      } else {
        const result = await window.api.hosts.import(exportKey);
        if (result.cancelled) {
          onClose();
          return;
        }
        onComplete(
          `Imported ${result.importedHosts ?? 0} host(s)`
          + (result.createdFolders ? ` and created ${result.createdFolders} workspace(s).` : '.'),
        );
      }
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="hosts-transfer-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{isExport ? 'Export hosts' : 'Import hosts'}</h2>
        <p className="hosts-transfer-hint">
          {isExport
            ? `Export ${selectedHostCount} of ${vms.length} host(s) and their credentials to an encrypted .vssh file.`
            : 'Import hosts from an encrypted .vssh export file into this vault.'}
          {' '}Use a separate export key — not your vault master password.
        </p>

        {isExport && (
          <div className="hosts-transfer-workspaces">
            <div className="hosts-transfer-workspaces-head">
              <span className="hosts-transfer-workspaces-title">Workspaces</span>
              <span className="hosts-transfer-workspaces-actions">
                <button type="button" onClick={selectAllWorkspaces}>Select all</button>
                <button type="button" onClick={deselectAllWorkspaces}>Deselect all</button>
              </span>
            </div>
            <div className="hosts-transfer-workspace-list">
              {folders.map((folder) => (
                <label key={folder.id} className="hosts-transfer-workspace-row">
                  <input
                    type="checkbox"
                    checked={selectedFolderIds.has(folder.id)}
                    onChange={() => toggleFolder(folder.id)}
                  />
                  <span className="hosts-transfer-workspace-name">{folder.name}</span>
                  <span className="hosts-transfer-workspace-count">{hostCounts.get(folder.id) ?? 0}</span>
                </label>
              ))}
              {unassignedCount > 0 && (
                <label className="hosts-transfer-workspace-row">
                  <input
                    type="checkbox"
                    checked={includeUnassigned}
                    onChange={(e) => setIncludeUnassigned(e.target.checked)}
                  />
                  <span className="hosts-transfer-workspace-name">Unassigned</span>
                  <span className="hosts-transfer-workspace-count">{unassignedCount}</span>
                </label>
              )}
            </div>
          </div>
        )}

        <label>
          Export encryption key
          <input
            type="password"
            value={exportKey}
            autoFocus={!isExport}
            onChange={(e) => setExportKey(e.target.value)}
            placeholder={`At least ${MIN_EXPORT_KEY_LEN} characters`}
            required
          />
        </label>
        {isExport && (
          <label>
            Confirm export key
            <input
              type="password"
              value={confirmKey}
              onChange={(e) => setConfirmKey(e.target.value)}
              placeholder="Re-enter export key"
              required
            />
          </label>
        )}
        {!keysMatch && confirmKey.length > 0 && (
          <p className="hosts-transfer-error">Export keys do not match.</p>
        )}
        {isExport && selectedHostCount === 0 && (
          <p className="hosts-transfer-error">Select at least one workspace with hosts to export.</p>
        )}
        {error && <p className="hosts-transfer-error">{error}</p>}
        <div className="hosts-transfer-actions">
          <button type="button" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" disabled={!canSubmit}>
            {busy ? 'Working…' : isExport ? 'Choose file & export' : 'Choose file & import'}
          </button>
        </div>
      </form>
    </div>
  );
}
