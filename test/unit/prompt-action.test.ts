import { describe, it, expect } from 'vitest';
import { decidePromptAction } from '../../src/main/ssh/prompt-action';
import { Vm, VaultEntry } from '../../src/shared/types';

function vm(overrides: Partial<Vm> = {}): Vm {
  return {
    id: 1,
    folderId: null,
    label: 'test',
    host: '127.0.0.1',
    port: 22,
    username: 'user',
    authMethod: 'password',
    keyPath: null,
    vaultRef: 'vault-ref',
    autoCopyDisabled: false,
    autoSubmitEnabled: true,
    lastUsedAt: null,
    createdAt: 1,
    ...overrides,
  };
}

const entry: VaultEntry = {
  password: 'login-secret',
  sudoPassword: 'sudo-secret',
  keyPassphrase: 'key-secret',
};

describe('decidePromptAction', () => {
  it('sends login passwords when auto-submit is enabled', () => {
    expect(decidePromptAction(vm(), entry, 'login')).toEqual({
      secret: 'login-secret',
      delivery: 'sent',
    });
  });

  it('sends key passphrases when auto-submit is enabled', () => {
    expect(decidePromptAction(vm(), entry, 'key-passphrase')).toEqual({
      secret: 'key-secret',
      delivery: 'sent',
    });
  });

  it('copies sudo passwords instead of auto-submitting them', () => {
    expect(decidePromptAction(vm(), entry, 'sudo')).toEqual({
      secret: 'sudo-secret',
      delivery: 'copied',
    });
  });

  it('copies login passwords when auto-submit is disabled', () => {
    expect(decidePromptAction(vm({ autoSubmitEnabled: false }), entry, 'login')).toEqual({
      secret: 'login-secret',
      delivery: 'copied',
    });
  });

  it('does not copy fallback secrets when auto-copy is disabled', () => {
    expect(decidePromptAction(vm({ autoSubmitEnabled: false, autoCopyDisabled: true }), entry, 'login')).toEqual({
      secret: undefined,
      delivery: 'none',
    });
  });

  it('still auto-submits eligible prompts when auto-copy is disabled', () => {
    expect(decidePromptAction(vm({ autoCopyDisabled: true }), entry, 'login')).toEqual({
      secret: 'login-secret',
      delivery: 'sent',
    });
  });

  it('returns none when the matching secret is missing', () => {
    expect(decidePromptAction(vm(), {}, 'login')).toEqual({
      secret: undefined,
      delivery: 'none',
    });
  });
});
