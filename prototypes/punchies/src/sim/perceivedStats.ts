import type {Tune} from './tune';
import type {CharId} from './character';
import {characterProportion} from './geometry';
export const perceivedStatKeys=['health','endurance','speed','power','reach'] as const;
export type PerceivedStat=typeof perceivedStatKeys[number];
const mean=(values:number[])=>values.reduce((sum,value)=>sum+value,0)/values.length;
/** Character-select ratios against an unmodified, unit-proportion Base fighter. */
export function perceivedStats(doc:Tune,id:CharId|'base'):Record<PerceivedStat,number>{
  if(id==='base')return {health:1,endurance:1,speed:1,power:1,reach:1};
  const c=doc.characters[id],types=['jab','cross','hook','uppercut'] as const;
  let baseFrames=0,frames=0;
  for(const type of types){const p=doc.punches[type];baseFrames+=p.startup+p.recovery;frames+=Math.max(1,p.startup+c[type].startup)+Math.max(1,p.recovery+c[type].recovery);}
  return {health:c.hp,endurance:mean([c.stamina,c.stun]),speed:mean([c.speed,baseFrames/frames]),power:mean(types.map(type=>c[type].damage)),reach:mean(types.map(type=>c[type].reach*characterProportion(id)))};
}
export const statBarFill=(ratio:number):number=>Math.max(0,Math.min(1,ratio*.8));
