import type { Portal, PortalStorage } from './types';

// Default adapter (itch.io, local dev, and the fallback when a portal SDK fails
// to load). localStorage when it works, memory when it does not (incognito).
export function webStorage(): PortalStorage {
  const memory = new Map<string, string|null>();
  const unreadable=new Set<string>();
  return {
    async preload() {},
    getItem(key) {
      if(memory.has(key))return memory.get(key)!;
      try { return localStorage.getItem(key); } catch {unreadable.add(key);return memory.get(key) ?? null; }
    },
    setItem(key, value) {
      memory.set(key, value);
      // A failed read is not proof that the save was absent. Keep this boot's
      // defaults in memory rather than overwriting an unreadable old save.
      if(unreadable.has(key))return;
      try { localStorage.setItem(key, value); } catch { /* private mode: memory only */ }
    },
    removeItem(key) {
      memory.set(key,null);
      try { localStorage.removeItem(key); } catch { /* private mode */ }
    },
    persistResetReceipt(key,value) {
      try {localStorage.setItem(key,value);if(localStorage.getItem(key)!==value)return false;memory.set(key,value);return true;}
      catch{return false;}
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
