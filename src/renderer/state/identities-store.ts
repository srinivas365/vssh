import { create } from 'zustand';
import { Identity, IdentityInput, IdentitySecrets, IdentitySecretsPatch } from '@shared/types';

interface IdentitiesStore {
  identities: Identity[];
  refresh: () => Promise<void>;
  create: (input: IdentityInput, secrets: IdentitySecrets) => Promise<Identity>;
  update: (id: number, input: IdentityInput, secrets?: IdentitySecretsPatch) => Promise<void>;
  remove: (id: number) => Promise<void>;
}

export const useIdentitiesStore = create<IdentitiesStore>((set, get) => ({
  identities: [],
  refresh: async () => {
    const identities = await window.api.identities.list();
    set({ identities });
  },
  create: async (input, secrets) => {
    const identity = await window.api.identities.create(input, secrets);
    await get().refresh();
    return identity;
  },
  update: async (id, input, secrets) => {
    await window.api.identities.update(id, input, secrets);
    await get().refresh();
  },
  remove: async (id) => {
    await window.api.identities.delete(id);
    await get().refresh();
  },
}));
