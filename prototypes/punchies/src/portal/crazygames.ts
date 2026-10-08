import { loadScript } from './loadScript';
import { webPortal } from './web';
import type { Portal, PortalStorage, RewardedResult } from './types';

// CrazyGames SDK v3 (docs.crazygames.com). Written against the documented API
// and covered by mock tests; not yet run against the real SDK.
interface CgSdk {
  init(): Promise<void>;
  game: { gameplayStart(): void; gameplayStop(): void; loadingStart?(): void; loadingStop?(): void };
  ad: { requestAd(type: 'midgame' | 'rewarded', cb: { adStarted(): void; adFinished(): void; adError(e: unknown): void }): void };
  user?: { systemInfo?: { locale?: string } };
  data: { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void };
}
const sdk = () => (globalThis as unknown as { CrazyGames?: { SDK: CgSdk } }).CrazyGames?.SDK;

export function crazyGamesPortal(adsEnabled: boolean): Portal {
  const fallback = webPortal();
  let ready = false;
  const storage: PortalStorage = {
    async preload() {},
    getItem: (k) => (ready ? sdk()!.data.getItem(k) : fallback.storage.getItem(k)),
    setItem: (k, v) => (ready ? sdk()!.data.setItem(k, v) : fallback.storage.setItem(k, v)),
    removeItem: (k) => (ready ? sdk()!.data.removeItem(k) : fallback.storage.removeItem(k)),
  };
  return {
    id: 'crazygames',
    async init() {
      try {
        await loadScript('https://sdk.crazygames.com/crazygames-sdk-v3.js');
        await sdk()!.init();
        ready = true;
      } catch { ready = false; }
    },
    loadingFinished() { if (ready) sdk()!.game.loadingStop?.(); },
    locale: () => (ready ? sdk()!.user?.systemInfo?.locale ?? null : null),
    gameplay(active) { if (ready) (active ? sdk()!.game.gameplayStart() : sdk()!.game.gameplayStop()); },
    ads: {
      get available() { return adsEnabled && ready; },
      kind: 'real',
      showRewarded(_placement, hooks): Promise<RewardedResult> {
        if (!adsEnabled || !ready) return Promise.resolve('unavailable');
        return new Promise((resolve) => {
          let done = false;
          const end = (r: RewardedResult) => { if (!done) { done = true; resolve(r); } };
          sdk()!.ad.requestAd('rewarded', {
            adStarted: () => hooks.onStart(),
            adFinished: () => end('rewarded'),
            adError: () => end('failed'),
          });
        });
      },
    },
    storage,
  };
}
