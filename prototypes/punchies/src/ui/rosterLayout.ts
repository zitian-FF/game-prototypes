// Shared geometric layout for pointer presentation and keyboard/controller navigation.
export const ROSTER_ROWS=[3,5,7,7,5,3];
export function rosterSlots():{x:number;y:number}[]{return ROSTER_ROWS.flatMap((count,row)=>Array.from({length:count},(_,column)=>({x:422+(column-(count-1)/2)*56,y:116+row*38})));}
export function verticalRosterPick(index:number,direction:number,count:number):number{
 const slots=rosterSlots().slice(0,count),from=slots[index];if(!from)return index;
 const candidates=slots.map((p,i)=>({p,i})).filter(({p})=>(p.y-from.y)*direction>0);
 candidates.sort((a,b)=>Math.abs(a.p.y-from.y)-Math.abs(b.p.y-from.y)||Math.abs(a.p.x-from.x)-Math.abs(b.p.x-from.x));
 return candidates[0]?.i??index;
}
