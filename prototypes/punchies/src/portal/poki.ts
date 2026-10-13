import { loadScript } from './loadScript';
import { webPortal } from './web';
import type { Portal, RewardedResult } from './types';

// Poki SDK v2 (sdk docs on developers.poki.com). Written against the documented
// API and covered by mock tests; not yet run against the real SDK. Poki has no
// save API: progress stays in localStorage (with a memory fallback for incognito).
interface PokiSdk {
  init(): Promise<void>;
  gameLoadingFinished(): void;
  gameplayStart(): void;
  gameplayStop(): void;
  rewardedBreak(beforeAd?: () => void): Promise<boolean>;
  measure?(category: string, what: string, action: string): void;
}
const sdk = () => (globalThis as unknown as { PokiSDK?: PokiSdk }).PokiSDK;

export function pokiPortal(adsEnabled: boolean): Portal {
  const web = webPortal();
  let ready = false;
  return {
    id: 'poki',
    async init() {
      try {
        await loadScript('https://game-cdn.poki.com/scripts/v2/poki-sdk.js');
        // Poki's docs: load the game even if init rejects.
        await sdk()!.init().catch(() => {});
        ready = !!sdk();
      } catch { ready = false; }
    },
    loadingFinished() { if (ready) sdk()!.gameLoadingFinished(); },
    gameplay(active) { if (ready) (active ? sdk()!.gameplayStart() : sdk()!.gameplayStop()); },
    // Poki's own measure(category, what, action); extra props stay in the local log.
    track(category, what, action) { if (ready) sdk()!.measure?.(category, what, action); },
    ads: {
      get available() { return adsEnabled && ready; },
      kind: 'real',
      async showRewarded(_placement, hooks): Promise<RewardedResult> {
        if (!adsEnabled || !ready) return 'unavailable';
        try { return (await sdk()!.rewardedBreak(() => hooks.onStart())) ? 'rewarded' : 'failed'; } catch { return 'failed'; }
      },
    },
    storage: web.storage,
  };
}
