import type { Portal, PortalStorage } from './types';

// Default adapter (itch.io, local dev, and the fallback when a portal SDK fails
// to load). localStorage when it works, memory when it does not (incognito).
export function webStorage(): PortalStorage {
  const memory = new Map<string, string>();
  return {
    async preload() {},
    getItem(key) {
      try { return localStorage.getItem(key); } catch { return memory.get(key) ?? null; }
    },
    setItem(key, value) {
      memory.set(key, value);
      try { localStorage.setItem(key, value); } catch { /* private mode: memory only */ }
    },
    removeItem(key) {
      memory.delete(key);
      try { localStorage.removeItem(key); } catch { /* private mode */ }
    },
  };
}

export function webPortal(): Portal {
  return {
    id: 'web',
    async init() {},
    loadingFinished() {},
    gameplay() {},
    // No ad network: the shop's ad button is a preview that grants the reward.
    ads: { available: true, kind: 'preview', showRewarded: async () => 'rewarded' },
    storage: webStorage(),
  };
}
