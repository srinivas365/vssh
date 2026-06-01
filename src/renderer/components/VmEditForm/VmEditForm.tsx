import React, { useState } from 'react';
import { Vm, VmInput, VaultEntry, AuthMethod } from '@shared/types';
import { useVmsStore } from '../../state/vms-store';
import { Select, SelectOption } from '../Select/Select';
import './VmEditForm.css';

const AUTH_OPTIONS: SelectOption<AuthMethod>[] = [
  { value: 'password', label: 'Password', description: 'Login with a saved password' },
  { value: 'key', label: 'Key', description: 'SSH key, optional passphrase' },
  { value: 'key+password', label: 'Key + Password', description: 'Try key first, fall back to password' },
];

interface Props {
  initial: Vm | null;
  onClose: () => void;
}

export function VmEditForm({ initial, onClose }: Props) {
  const { create, update } = useVmsStore();
  const [label, setLabel] = useState(initial?.label ?? '');
  const [host, setHost] = useState(initial?.host ?? '');
  const [port, setPort] = useState(initial?.port ?? 22);
  const [username, setUsername] = useState(initial?.username ?? '');
  const [authMethod, setAuthMethod] = useState<AuthMethod>(initial?.authMethod ?? 'password');
  const [keyPath, setKeyPath] = useState(initial?.keyPath ?? '');
  const [password, setPassword] = useState('');
  const [sudoPassword, setSudoPassword] = useState('');
  const [keyPassphrase, setKeyPassphrase] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const input: VmInput = {
      folderId: initial?.folderId ?? null,
      label, host, port, username, authMethod,
      keyPath: authMethod === 'password' ? null : (keyPath || null),
    };
    const secret: VaultEntry = {
      password: authMethod !== 'key' ? password || undefined : undefined,
      sudoPassword: sudoPassword || undefined,
      keyPassphrase: authMethod !== 'password' ? keyPassphrase || undefined : undefined,
    };
    if (initial) await update(initial.id, input, secret);
    else await create(input, secret);
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="vm-form" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{initial ? 'Edit VM' : 'New VM'}</h2>
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
            <label>Key passphrase <input type="password" value={keyPassphrase} onChange={(e) => setKeyPassphrase(e.target.value)} /></label>
          </>
        )}
        {authMethod !== 'key' && (
          <label>Password <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        )}
        <label>Sudo password <input type="password" value={sudoPassword} onChange={(e) => setSudoPassword(e.target.value)} /></label>
        <div className="form-actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit">{initial ? 'Save' : 'Create'}</button>
        </div>
      </form>
    </div>
  );
}
