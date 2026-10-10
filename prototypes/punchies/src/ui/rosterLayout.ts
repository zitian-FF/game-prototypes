import { CHARACTER_IDS } from '../sim/character';
export const ROSTER_ROWS=[3,5,7,7,5,3];
export function rosterSlots():{x:number;y:number}[]{return ROSTER_ROWS.flatMap((count,row)=>Array.from({length:count},(_,column)=>({x:422+(column-(count-1)/2)*56,y:116+row*38})));}
// Reserve future fighters without making unfinished characters selectable.
export function rosterIds(ids:readonly string[]=CHARACTER_IDS):(string|null)[]{
 const result:(string|null)[]=Array(30).fill(null);
 const reserved=['tee','marco','mia','bruno','roxy','nadia'];
 for(const [slot,id] of [[0,'tee'],[3,'marco'],[4,'mia'],[5,'bruno'],[6,'roxy'],[7,'nadia']] as const)if(ids.includes(id))result[slot]=id;
 const free=[12,18,9,20,15,10,19,8,17,13,21,11,16,14,1,2,22,23,24,25,26,27,28,29];
 ids.filter(id=>!reserved.includes(id)).forEach((id,i)=>{if(free[i]!==undefined)result[free[i]]=id;});
 return result;
}
export function horizontalRosterPick(index:number,direction:number):number{
 const order=rosterIds().filter((id):id is string=>id!==null),current=order.indexOf(CHARACTER_IDS[index]);
 return CHARACTER_IDS.indexOf(order[(current+Math.sign(direction)+order.length)%order.length] as typeof CHARACTER_IDS[number]);
}
export function verticalRosterPick(index:number,direction:number,_count?:number):number{
 const ids=rosterIds(),positions=rosterSlots(),from=positions[ids.indexOf(CHARACTER_IDS[index])];if(!from)return index;
 const candidates=positions.map((p,i)=>({p,i})).filter(({p,i})=>ids[i]&&(p.y-from.y)*direction>0);
 candidates.sort((a,b)=>Math.abs(a.p.y-from.y)-Math.abs(b.p.y-from.y)||Math.abs(a.p.x-from.x)-Math.abs(b.p.x-from.x));
 return candidates.length?CHARACTER_IDS.indexOf(ids[candidates[0].i] as typeof CHARACTER_IDS[number]):index;
}
