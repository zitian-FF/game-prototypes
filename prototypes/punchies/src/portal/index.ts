import { suspendAudioForAd } from '../audio/mixer';
import { setGameplay } from './gameplay';
import { KEYS } from './keys';
import { portal } from './select';
import type { RewardedResult } from './types';

export { portal } from './select';
export { store } from './store';

/** Start the SDK and load saved data. Never rejects, and never blocks boot for long. */
export async function initPortal(timeoutMs = 10000): Promise<void> {
  const work = (async () => { await portal.init(); await portal.storage.preload(Object.values(KEYS)); })();
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
  try { await Promise.race([work, timeout]); } catch { /* boot anyway */ }
}

let loaded = false;
/** The first menu is up. Safe to call from every menu scene: only the first call reaches the portal. */
export function loadingFinished(): void {
  if (loaded) return;
  loaded = true;
  try { portal.loadingFinished(); } catch { /* SDK errors must never break boot */ }
}

/** One rewarded ad. Mutes the game while it plays; the caller grants the reward only on 'rewarded'. */
export async function showRewardedAd(placement: string): Promise<RewardedResult> {
  setGameplay(false);
  let result: RewardedResult;
  try {
    result = await portal.ads.showRewarded(placement, { onStart: () => suspendAudioForAd(true) });
  } catch { result = 'failed'; }
  suspendAudioForAd(false);
  return result;
}
