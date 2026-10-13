import type {Tune} from './tune';
import type {CharId} from './character';
import {statFill,type RosterStat} from './rosterStats';
export const perceivedStatKeys=['durability','endurance','speed','power','reach'] as const;
const types=['jab','cross','hook'] as const;
const mean=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/xs.length;
/** Match the current roster display without mutating live tuning. */
export function perceivedStats(doc:Tune,id:CharId|'base'):Record<RosterStat,number>{
 if(id==='base')return {durability:1,endurance:1,speed:1,power:1,reach:1};
 const c=doc.characters[id];
 const handSpeed=mean(types.map(type=>{const b=doc.punches[type],o=c[type],active=b.sourEarly+b.sweet+b.sour;return (b.startup+active+b.recovery)/(Math.max(1,b.startup+o.startup)+active+Math.max(1,b.recovery+o.recovery));}));
 return {durability:.7*c.hp+.3*c.stun,endurance:.5*c.stamina+.25*c.regen+.25*mean(types.map(type=>1/c[type].staminaCost)),speed:.5*c.speed+.5*handSpeed,power:mean(types.map(type=>c[type].damage)),reach:mean(types.map(type=>c[type].reach*doc.body.proportions[id]))};
}
export const statBarFill=(ratio:number,stat:RosterStat='durability'):number=>statFill(stat,ratio);
