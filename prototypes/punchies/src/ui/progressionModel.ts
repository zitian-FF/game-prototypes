import cfg from '../progress/progress-config.json';
import {progressView, progressDay, type MatchAward, type ProgressConfig, type ProgressView} from '../progress/rules';

/** Presentation only: neither writes saves nor awards XP/rewards. */
export function awardViews(award:MatchAward): {before:ProgressView;after:ProgressView} {
 const day=progressDay();
 const before={...award.state,totalXp:Math.max(0,award.state.totalXp-award.xpGained)};
 return {before:progressView(cfg as ProgressConfig,before,day),after:progressView(cfg as ProgressConfig,award.state,day)};
}
export const xpFraction=(view:Pick<ProgressView,'xp'|'xpToNext'|'maxed'>):number=>view.maxed?1:Math.max(0,Math.min(1,view.xp/Math.max(1,view.xpToNext)));
export function profileLayout(width:number,height:number) {
 const w=Math.min(760,width-32),h=height-116,left=Math.min(282,w*.4),gap=18;
 return {w,h,left,gap,right:w-left-gap,cardW:(w-left-gap-12)/2,cardH:(h-63)/2};
}
