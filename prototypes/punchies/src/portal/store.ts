import { portal } from './select';

/** localStorage-shaped store that routes to the portal's save system. */
export const store = {
  getItem(key: string): string | null { try { return portal.storage.getItem(key); } catch { return null; } },
  setItem(key: string, value: string): void { try { portal.storage.setItem(key, value); } catch { /* storage unavailable */ } },
  removeItem(key: string): void { try { portal.storage.removeItem(key); } catch { /* storage unavailable */ } },
};
