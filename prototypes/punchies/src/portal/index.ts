import { suspendAudioForAd,reloadAudioSettings } from '../audio/mixer';
import {applySaveReset,type SaveResetReceipt} from './saveReset';
import { setGameplay } from './gameplay';
import { KEYS,MASTER_KEYS } from './keys';
import {CRAZYGAMES_EDITION} from '../edition';
import {STAGING_BUILD} from '../buildFlags';
import {webStorage} from './web';
import {migrateCrazyGamesSaves} from './editionMigration';
import { portal } from './select';
import type { RewardedResult } from './types';

export { portal } from './select';
export { store } from './store';
let resetReceipt:SaveResetReceipt|null=null;
export const saveResetReceipt=()=>resetReceipt?{...resetReceipt,keys:[...resetReceipt.keys]}:null;

/** Start the SDK and load saved data. Never rejects, and never blocks boot for long. */
export async function initPortal(timeoutMs = 10000): Promise<void> {
  const work = (async () => { await portal.init(); await portal.storage.preload(Object.values(KEYS)); })();
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
  try { await Promise.race([work, timeout]); } catch { /* boot anyway */ }
  if(CRAZYGAMES_EDITION&&!STAGING_BUILD)migrateCrazyGamesSaves(portal.storage,webStorage(),MASTER_KEYS,KEYS);
  resetReceipt=applySaveReset(portal.storage);reloadAudioSettings();
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
