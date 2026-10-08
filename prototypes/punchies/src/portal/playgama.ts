import { loadScript } from './loadScript';
import { webStorage } from './web';
import type { Portal, PortalStorage, RewardedResult } from './types';

// Playgama Bridge v2 (wiki.playgama.com). Written against the documented API and
// covered by mock tests; not yet run against the real SDK. Bridge storage is
// asynchronous, so the registered keys are loaded into a cache before the first
// scene; writes update the cache at once and are sent to Bridge.
interface Bridge {
  initialize(): Promise<void>;
  platform: { sendMessage(m: string): void };
  advertisement: { showRewarded(placement?: string): void; on(event: string, cb: (state: string) => void): void; off?(event: string, cb: (state: string) => void): void };
  storage: { get(keys: string[]): Promise<(string | null)[]>; set(key: string, value: string): Promise<unknown>; delete(key: string): Promise<unknown> };
  EVENT_NAME: { REWARDED_STATE_CHANGED: string };
}
const bridge = () => (globalThis as unknown as { bridge?: Bridge }).bridge;

export function playgamaPortal(adsEnabled: boolean): Portal {
  let ready = false;
  let begun = false;
  const fallback = webStorage();
  const cache = new Map<string, string | null>();
  const storage: PortalStorage = {
    async preload(keys) {
      if (!ready) return;
      try {
        const values = await bridge()!.storage.get([...keys]);
        keys.forEach((k, i) => cache.set(k, values[i] ?? null));
      } catch { /* fall back to local values */ }
    },
    getItem: (k) => (ready ? (cache.has(k) ? cache.get(k)! : null) : fallback.getItem(k)),
    setItem(k, v) { if (!ready) return fallback.setItem(k, v); cache.set(k, v); void bridge()!.storage.set(k, v).catch(() => {}); },
    removeItem(k) { if (!ready) return fallback.removeItem(k); cache.set(k, null); void bridge()!.storage.delete(k).catch(() => {}); },
  };
  return {
    id: 'playgama',
    async init() {
      try {
        await loadScript('https://bridge.playgama.com/v2/stable/playgama-bridge.js');
        await bridge()!.initialize();
        ready = true;
      } catch { ready = false; }
    },
    loadingFinished() { if (ready) bridge()!.platform.sendMessage('game_ready'); },
    gameplay(active) {
      if (!ready) return;
      bridge()!.platform.sendMessage(active ? (begun ? 'level_resumed' : 'level_started') : 'level_paused');
      if (active) begun = true;
    },
    ads: {
      get available() { return adsEnabled && ready; },
      kind: 'real',
      showRewarded(placement, hooks): Promise<RewardedResult> {
        if (!adsEnabled || !ready) return Promise.resolve('unavailable');
        const b = bridge()!;
        return new Promise((resolve) => {
          let rewarded = false;
          const onState = (state: string) => {
            if (state === 'opened') hooks.onStart();
            if (state === 'rewarded') rewarded = true;
            if (state === 'closed' || state === 'failed') { b.advertisement.off?.(b.EVENT_NAME.REWARDED_STATE_CHANGED, onState); resolve(rewarded ? 'rewarded' : 'failed'); }
          };
          b.advertisement.on(b.EVENT_NAME.REWARDED_STATE_CHANGED, onState);
          b.advertisement.showRewarded(placement);
        });
      },
    },
    storage,
  };
}
