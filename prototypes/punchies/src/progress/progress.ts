import {pendingKaiRewards,KAI_MILESTONES} from './kaiRewards';
import { store } from '../portal/store';
import { KEYS } from '../portal/keys';
import { track } from '../portal/analytics';
import { loadShopDraft, saveShopDraft, grantVoucher, grantSkin, grantFighter, SHOP_ITEMS } from '../shop/draft';
import cfg from './progress-config.json';
import {
  applyMatch, newProgress, normalizeProgress, progressDay, progressView as buildView,rewardLadder,
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

function kaiItemReady(id:string):boolean {
 const ready=(key:string)=>SHOP_ITEMS.some(item=>item.id===key&&item.earnOnly&&!item.artPending);
 return ready(id)&&(id==='fighter-kai'||ready('fighter-kai'));
}
/** Idempotent ownership catch-up; never runs historical chest/XP/title awards. */
export function catchUpKaiRewards(state=loadProgress()):Reward[]{
 let shop=loadShopDraft();

 const granted:Reward[]=[];
 for(const reward of pendingKaiRewards(C,state,shop.owned,kaiItemReady)){
   if(reward.kind!=='fighter'&&reward.kind!=='skin')continue;
   const next=reward.kind==='fighter'?grantFighter(shop,reward.id):grantSkin(shop,reward.id);
   if(next){shop=next;granted.push(reward);}
 }
 if(granted.length)saveShopDraft(shop);
 return granted;
}
export const progressView = (now = Date.now()): ProgressView => {const state=loadProgress(now);catchUpKaiRewards(state);return buildView(C,state,progressDay(now));};
export const progressionLadder=(now=Date.now())=>rewardLadder(C,loadProgress(now),progressDay(now));

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
      if((r.kind==='fighter'||r.kind==='skin')&&KAI_MILESTONES.some(m=>m.id===r.id)&&!kaiItemReady(r.id))continue;
      if (r.kind === 'skinChest') { shop = grantVoucher(shop, 'skins'); grantedRewards.push(r); }
      else if (r.kind === 'fighterChest') { shop = grantVoucher(shop, 'fighters'); grantedRewards.push(r); }
      else if (r.kind === 'fighter') {const next=grantFighter(shop,r.id);if(next){shop=next;grantedRewards.push(r);}}
      else if (r.kind === 'skin') { const next = grantSkin(shop, r.id); if (next) { shop = next; grantedRewards.push(r); } }
      else grantedRewards.push(r);
    }
    track('progress', 'level', 'up', { level: up.level });
  }
  if (award.levelUps.length) saveShopDraft(shop);
  catchUpKaiRewards(award.state);
  track('progress', m.kind, 'xp', { xp: award.xpGained, capped: award.capped });
  return { ...award, grantedRewards };
}
