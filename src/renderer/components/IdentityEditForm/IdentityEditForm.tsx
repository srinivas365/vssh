import React, { useEffect, useState } from 'react';
import type { Identity } from '@shared/types';
import { useIdentitiesStore } from '../../state/identities-store';
import '../VmEditForm/VmEditForm.css';

interface Props {
  initial: Identity | null;
  onClose: () => void;
}

export function IdentityEditForm({ initial, onClose }: Props) {
  const { create, update } = useIdentitiesStore();
  const [label, setLabel] = useState(initial?.label ?? '');
  const [username, setUsername] = useState(initial?.username ?? '');
  const [password, setPassword] = useState('');
  const [sudoPassword, setSudoPassword] = useState('');
  const [sudoSameAsPassword, setSudoSameAsPassword] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!initial) return;
    void window.api.identities.getCredentials(initial.id).then((creds) => {
      const hasSeparateSudo =
        creds.sudoPassword.length > 0 && creds.sudoPassword !== creds.password;
      setSudoSameAsPassword(!hasSeparateSudo);
    });
  }, [initial]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmedLabel = label.trim();
    const trimmedUsername = username.trim();
    if (!trimmedLabel || !trimmedUsername) {
      setError('Label and username are required.');
      return;
    }
    if (!initial && !password) {
      setError('Password is required for a new identity.');
      return;
    }
    if (!sudoSameAsPassword && !initial && !sudoPassword) {
      setError('Sudo password is required when it differs from the login password.');
      return;
    }
    try {
      const input = { label: trimmedLabel, username: trimmedUsername };
      if (initial) {
        const secrets = {
          ...(password ? { password } : {}),
          ...(sudoSameAsPassword
            ? { sudoSameAsPassword: true as const }
            : sudoPassword
              ? { sudoPassword }
              : {}),
        };
        await update(initial.id, input, Object.keys(secrets).length > 0 ? secrets : undefined);
      } else {
        await create(input, {
          password,
          sudoPassword: sudoSameAsPassword ? undefined : sudoPassword,
        });
      }
      onClose();
    } catch {
      setError('Could not save identity.');
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="vm-form" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{initial ? 'Edit identity' : 'New identity'}</h2>
        <p className="vm-form-hint">
          Saved login credentials you can reuse when creating hosts.
        </p>
        <label>
          Label
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Production admin" required />
        </label>
        <label>
          Username
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. ubuntu" required />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={initial ? 'Leave blank to keep current password' : 'Required'}
            required={!initial}
          />
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={sudoSameAsPassword}
            onChange={(e) => {
              setSudoSameAsPassword(e.target.checked);
              if (e.target.checked) setSudoPassword('');
            }}
          />
          Sudo password is same as above
        </label>
        {!sudoSameAsPassword && (
          <label>
            Sudo password
            <input
              type="password"
              value={sudoPassword}
              onChange={(e) => setSudoPassword(e.target.value)}
              placeholder={initial ? 'Leave blank to keep current sudo password' : 'Required'}
              required={!initial}
            />
          </label>
        )}
        {error && <p className="connection-test-message is-error">{error}</p>}
        <div className="form-actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit">{initial ? 'Save' : 'Create'}</button>
        </div>
      </form>
    </div>
  );
}
