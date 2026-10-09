import { store } from '../portal/store';
import { KEYS } from '../portal/keys';
import { track } from '../portal/analytics';
import { loadShopDraft, saveShopDraft, grantVoucher, grantSkin } from '../shop/draft';
import cfg from './progress-config.json';
import {
  applyMatch, newProgress, normalizeProgress, progressDay, progressView as buildView,
  type MatchAward, type MatchOutcome, type ProgressConfig, type ProgressState, type ProgressView, type Reward,
} from './rules';

const C = cfg as ProgressConfig;

export function loadProgress(now = Date.now()): ProgressState {
  try { return normalizeProgress(JSON.parse(store.getItem(KEYS.progress) ?? 'null'), progressDay(now), C); }
  catch { return newProgress(progressDay(now)); }
}
function saveProgress(s: ProgressState): void {
  try { store.setItem(KEYS.progress, JSON.stringify(s)); } catch { /* storage unavailable */ }
}

export const progressView = (now = Date.now()): ProgressView => buildView(C, loadProgress(now), progressDay(now));

export function setTitle(id: string): boolean {
  const s = loadProgress();
  if (!progressView().unlockedTitles.includes(id)) return false;
  saveProgress({ ...s, titleId: id });
  return true;
}

/** Called once when a match finishes. Saves XP, grants milestone rewards, and returns what happened for the result screen. */
export function awardMatch(m: MatchOutcome, now = Date.now()): MatchAward & { grantedRewards: Reward[] } {
  const award = applyMatch(C, loadProgress(now), m, progressDay(now));
  saveProgress(award.state);
  const grantedRewards: Reward[] = [];
  let shop = loadShopDraft();
  for (const up of award.levelUps) {
    for (const r of up.rewards) {
      if (r.kind === 'skinChest') { shop = grantVoucher(shop, 'skins'); grantedRewards.push(r); }
      else if (r.kind === 'fighterChest') { shop = grantVoucher(shop, 'fighters'); grantedRewards.push(r); }
      else if (r.kind === 'skin') { const next = grantSkin(shop, r.id); if (next) { shop = next; grantedRewards.push(r); } }
      else grantedRewards.push(r);
    }
    track('progress', 'level', 'up', { level: up.level });
  }
  if (award.levelUps.length) saveShopDraft(shop);
  track('progress', m.kind, 'xp', { xp: award.xpGained, capped: award.capped });
  return { ...award, grantedRewards };
}
