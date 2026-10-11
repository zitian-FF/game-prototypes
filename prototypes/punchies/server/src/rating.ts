export interface Player { rating:number; matches:number }
export type Score=0|0.5|1;
export const kFactor=(p:Player)=>p.matches<10?40:p.rating>1400?16:24;
export const farmFactor=(gap:number)=>gap<=100?1:gap>=300?.1:1-.9*(gap-100)/200;
/** One symmetric K and one rounding operation; clamp the transfer, not each total. */
export function ratingChange(a:Player,b:Player,score:Score):[number,number]{
 const expected=1/(1+10**((b.rating-a.rating)/400));
 const transfer=Math.max(kFactor(a),kFactor(b))*(score-expected)*farmFactor(Math.abs(a.rating-b.rating));
 const raw=Math.sign(transfer)*Math.round(Math.abs(transfer));
 const delta=Math.max(-a.rating,Math.min(b.rating,raw));
 return [delta,-delta];
}
export interface Report { score:Score; quit:boolean }
export function agreedScore(a:Report|null,b:Report|null):Score|null{
 if(a?.quit&&b?.quit)return null;
 if(a?.quit)return 0;
 if(b?.quit)return 1;
 return a&&b&&a.score+b.score===1?a.score:null;
}
