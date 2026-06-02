import { PromptType, VaultEntry, Vm } from '@shared/types';

export type PromptDelivery = 'copied' | 'sent' | 'none';

export interface PromptAction {
  secret: string | undefined;
  delivery: PromptDelivery;
}

export function pickSecretByPrompt(entry: VaultEntry, type: PromptType): string | undefined {
  switch (type) {
    case 'login':
    case 'generic':
      return entry.password;
    case 'sudo':
      return entry.sudoPassword;
    case 'key-passphrase':
      return entry.keyPassphrase;
  }
}

function canAutoSubmit(type: PromptType): boolean {
  return type === 'login' || type === 'key-passphrase';
}

export function decidePromptAction(vm: Vm, entry: VaultEntry, type: PromptType): PromptAction {
  const secret = pickSecretByPrompt(entry, type);
  if (!secret) return { secret: undefined, delivery: 'none' };

  if (vm.autoSubmitEnabled && canAutoSubmit(type)) {
    return { secret, delivery: 'sent' };
  }

  if (!vm.autoCopyDisabled) {
    return { secret, delivery: 'copied' };
  }

  return { secret: undefined, delivery: 'none' };
}
