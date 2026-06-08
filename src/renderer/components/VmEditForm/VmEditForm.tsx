import React, { useEffect, useState } from 'react';
import { Vm, VmInput, VaultEntry, AuthMethod, VmConnectionTestResult } from '@shared/types';
import { buildCloneInput } from '@shared/vm-clone';
import { useVmsStore } from '../../state/vms-store';
import { Select, SelectOption } from '../Select/Select';
import './VmEditForm.css';

const AUTH_OPTIONS: SelectOption<AuthMethod>[] = [
  { value: 'password', label: 'Password', description: 'Login with a saved password' },
  { value: 'key', label: 'Key', description: 'SSH key, optional passphrase' },
  { value: 'key+password', label: 'Key + Password', description: 'Try key first, fall back to password' },
];

const NEW_FOLDER_VALUE = '__new__';

interface Props {
  initial: Vm | null;
  cloneFrom?: Vm;
  onClose: () => void;
}

export function VmEditForm({ initial, cloneFrom, onClose }: Props) {
  const { create, clone, update, folders, createFolder } = useVmsStore();
  const draft = cloneFrom ? buildCloneInput(cloneFrom) : null;
  const defaultFolderId =
    draft?.folderId ?? initial?.folderId ?? folders.find((f) => f.name === 'Default')?.id ?? folders[0]?.id ?? null;

  const [folderId, setFolderId] = useState<number | null>(defaultFolderId);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const [label, setLabel] = useState(draft?.label ?? initial?.label ?? '');
  const [host, setHost] = useState(draft?.host ?? initial?.host ?? '');
  const [port, setPort] = useState(draft?.port ?? initial?.port ?? 22);
  const [username, setUsername] = useState(draft?.username ?? initial?.username ?? '');
  const [authMethod, setAuthMethod] = useState<AuthMethod>(draft?.authMethod ?? initial?.authMethod ?? 'password');
  const [keyPath, setKeyPath] = useState(draft?.keyPath ?? initial?.keyPath ?? '');
  const [password, setPassword] = useState('');
  const [sudoPassword, setSudoPassword] = useState('');
  const [keyPassphrase, setKeyPassphrase] = useState('');
  const [autoSubmitEnabled, setAutoSubmitEnabled] = useState(
    draft?.autoSubmitEnabled ?? initial?.autoSubmitEnabled ?? true,
  );
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<VmConnectionTestResult | null>(null);

  const workspaceOptions: SelectOption<string>[] = [
    ...folders.map((f) => ({ value: String(f.id), label: f.name })),
    { value: NEW_FOLDER_VALUE, label: 'Create new workspace…' },
  ];

  function onWorkspaceChange(v: string) {
    if (v === NEW_FOLDER_VALUE) {
      setCreatingFolder(true);
    } else {
      setFolderId(Number(v));
    }
  }

  async function commitNewFolder() {
    const trimmed = newFolderName.trim();
    if (!trimmed) {
      setCreatingFolder(false);
      return;
    }
    const created = await createFolder(trimmed);
    setFolderId(created.id);
    setNewFolderName('');
    setCreatingFolder(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const input = buildVmInput();
    const secret = buildVaultEntry();
    if (cloneFrom) await clone(cloneFrom.id, input);
    else if (initial) await update(initial.id, input, secret);
    else await create(input, secret);
    onClose();
  }

  const canTestConnection = host.trim().length > 0 && username.trim().length > 0 && Number.isFinite(port) && port > 0;

  useEffect(() => {
    setConnectionTestResult(null);
  }, [host, port, username, authMethod, keyPath, password, keyPassphrase]);

  function buildVmInput(): VmInput {
    return {
      folderId,
      label,
      host,
      port,
      username,
      authMethod,
      keyPath: authMethod === 'password' ? null : (keyPath || null),
      autoSubmitEnabled,
    };
  }

  function buildVaultEntry(): VaultEntry {
    return {
      password: authMethod !== 'key' ? password || undefined : undefined,
      sudoPassword: sudoPassword || undefined,
      keyPassphrase: authMethod !== 'password' ? keyPassphrase || undefined : undefined,
    };
  }

  async function testConnection() {
    if (!canTestConnection || isTestingConnection) return;
    setIsTestingConnection(true);
    setConnectionTestResult(null);
    try {
      const result = await window.api.vms.testConnection(buildVmInput(), buildVaultEntry());
      setConnectionTestResult(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection test failed.';
      setConnectionTestResult({ ok: false, latencyMs: null, message });
    } finally {
      setIsTestingConnection(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="vm-form" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{cloneFrom ? 'Clone host' : initial ? 'Edit VM' : 'New VM'}</h2>
        {cloneFrom && (
          <p className="vm-form-hint">Credentials are copied from {cloneFrom.label}. Adjust the host if needed.</p>
        )}
        <label>
          Workspace
          <Select<string>
            value={folderId !== null ? String(folderId) : ''}
            options={workspaceOptions}
            onChange={onWorkspaceChange}
          />
        </label>
        {creatingFolder && (
          <input
            placeholder="New workspace name"
            value={newFolderName}
            autoFocus
            onChange={(e) => setNewFolderName(e.target.value)}
            onBlur={commitNewFolder}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); void commitNewFolder(); }
              else if (e.key === 'Escape') { setCreatingFolder(false); setNewFolderName(''); }
            }}
          />
        )}
        <label>Label <input value={label} onChange={(e) => setLabel(e.target.value)} required /></label>
        <label>Host  <input value={host} onChange={(e) => setHost(e.target.value)} required /></label>
        <label>Port  <input type="number" value={port} onChange={(e) => setPort(Number(e.target.value))} /></label>
        <label>User  <input value={username} onChange={(e) => setUsername(e.target.value)} required /></label>
        <label>
          Auth
          <Select<AuthMethod>
            value={authMethod}
            options={AUTH_OPTIONS}
            onChange={setAuthMethod}
          />
        </label>
        {authMethod !== 'password' && (
          <>
            <label>Key path <input value={keyPath} onChange={(e) => setKeyPath(e.target.value)} placeholder="~/.ssh/id_rsa" /></label>
            {!cloneFrom && (
              <label>Key passphrase <input type="password" value={keyPassphrase} onChange={(e) => setKeyPassphrase(e.target.value)} /></label>
            )}
          </>
        )}
        {authMethod !== 'key' && !cloneFrom && (
          <label>Password <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        )}
        {!cloneFrom && (
          <label>Sudo password <input type="password" value={sudoPassword} onChange={(e) => setSudoPassword(e.target.value)} /></label>
        )}
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={autoSubmitEnabled}
            onChange={(e) => setAutoSubmitEnabled(e.target.checked)}
          />
          Automatically submit login/key secrets
        </label>
        <div className="connection-test">
          <button
            type="button"
            className="connection-test-button"
            disabled={!canTestConnection || isTestingConnection || !!cloneFrom}
            onClick={() => { void testConnection(); }}
          >
            {isTestingConnection ? 'Testing...' : 'Test connection'}
          </button>
          {connectionTestResult && (
            <p className={`connection-test-message ${connectionTestResult.ok ? 'is-success' : 'is-error'}`}>
              {connectionTestResult.message}
              {connectionTestResult.ok && connectionTestResult.latencyMs !== null
                ? ` (${connectionTestResult.latencyMs} ms)`
                : ''}
            </p>
          )}
        </div>
        <div className="form-actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit">{cloneFrom ? 'Clone' : initial ? 'Save' : 'Create'}</button>
        </div>
      </form>
    </div>
  );
}
