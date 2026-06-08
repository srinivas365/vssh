import React, { useState } from 'react';
import { MIN_EXPORT_KEY_LEN } from '@shared/hosts-export';
import './HostsTransferModal.css';

type Mode = 'export' | 'import';

interface Props {
  mode: Mode;
  hostCount: number;
  onClose: () => void;
  onComplete: (message: string) => void;
}

function errorMessage(error: unknown): string {
  const msg = error instanceof Error ? error.message : '';
  if (msg === 'export-key-too-short') return `Export key must be at least ${MIN_EXPORT_KEY_LEN} characters.`;
  if (msg === 'invalid-export-key') return 'Wrong export key or corrupted export file.';
  if (msg === 'invalid-export-file') return 'This file is not a valid vssh export.';
  if (msg === 'vault-locked') return 'Unlock the vault before exporting or importing hosts.';
  return 'Export/import failed. Try again.';
}

export function HostsTransferModal({ mode, hostCount, onClose, onComplete }: Props) {
  const [exportKey, setExportKey] = useState('');
  const [confirmKey, setConfirmKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isExport = mode === 'export';
  const keysMatch = !isExport || exportKey === confirmKey;
  const longEnough = exportKey.length >= MIN_EXPORT_KEY_LEN;
  const canSubmit = longEnough && keysMatch && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      if (isExport) {
        const result = await window.api.hosts.export(exportKey);
        if (result.cancelled) {
          onClose();
          return;
        }
        onComplete(`Exported ${result.hostCount ?? hostCount} host(s) to ${result.path ?? 'file'}.`);
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
            ? `Export all ${hostCount} saved host(s) and their credentials to an encrypted .vssh file.`
            : 'Import hosts from an encrypted .vssh export file into this vault.'}
          {' '}Use a separate export key — not your vault master password.
        </p>
        <label>
          Export encryption key
          <input
            type="password"
            value={exportKey}
            autoFocus
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
