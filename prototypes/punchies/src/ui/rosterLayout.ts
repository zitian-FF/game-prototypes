import { CHARACTER_IDS } from '../sim/character';
import { CRAZYGAMES_EDITION } from '../edition';
export const ROSTER_ROWS=CRAZYGAMES_EDITION?[5,6]:[3,5,7,7,5,3];
export function rosterSlots():{x:number;y:number}[]{return ROSTER_ROWS.flatMap((count,row)=>Array.from({length:count},(_,column)=>({x:422+(column-(count-1)/2)*(CRAZYGAMES_EDITION?66:56),y:CRAZYGAMES_EDITION?172+row*80:116+row*38})));}
export function rosterCardGeometry(){return CRAZYGAMES_EDITION
 ? {width:54,height:58,portraitWidth:44,portraitHeight:42,portraitY:-6,labelY:23,labelSize:8,hitWidth:62,hitHeight:66,cursorWidth:58,cursorHeight:62,lockX:20,lockY:-25,darkY:-27,darkHeight:42}
 : {width:50,height:34,portraitWidth:43,portraitHeight:27,portraitY:-5,labelY:13,labelSize:7,hitWidth:51,hitHeight:34,cursorWidth:52,cursorHeight:36,lockX:18,lockY:-13,darkY:-19,darkHeight:28};}
// Reserve future fighters without making unfinished characters selectable.
export function rosterIds(ids:readonly string[]=CHARACTER_IDS):(string|null)[]{
 if(CRAZYGAMES_EDITION)return [...ids]; // Build's manifest supplies the authoritative top-five/bottom-six order.
 const result:(string|null)[]=Array(30).fill(null);
 const reserved=['tee','marco','mia','bruno','roxy','nadia','kai'];
 for(const [slot,id] of [[0,'tee'],[3,'marco'],[4,'mia'],[5,'bruno'],[6,'roxy'],[7,'nadia'],[29,'kai']] as const)if(ids.includes(id))result[slot]=id;
 const free=[12,18,9,20,15,10,19,8,17,13,21,11,16,14,1,2,22,23,24,25,26,27,28];
 ids.filter(id=>!reserved.includes(id)).forEach((id,i)=>{if(free[i]!==undefined)result[free[i]]=id;});
 return result;
}
export function horizontalRosterPick(index:number,direction:number):number{
 if(CRAZYGAMES_EDITION){
  const ids=rosterIds(),positions=rosterSlots(),slot=ids.indexOf(CHARACTER_IDS[index]),from=positions[slot];if(!from)return index;
  const row=ids.map((id,i)=>({id,i})).filter(({id,i})=>id&&positions[i]?.y===from.y);
  const current=row.findIndex(p=>p.i===slot),next=row[(current+Math.sign(direction)+row.length)%row.length];
  return CHARACTER_IDS.indexOf(next.id as typeof CHARACTER_IDS[number]);
 }
 const order=rosterIds().filter((id):id is string=>id!==null),current=order.indexOf(CHARACTER_IDS[index]);
 return CHARACTER_IDS.indexOf(order[(current+Math.sign(direction)+order.length)%order.length] as typeof CHARACTER_IDS[number]);
}
export function verticalRosterPick(index:number,direction:number,_count?:number):number{
 const ids=rosterIds(),positions=rosterSlots(),from=positions[ids.indexOf(CHARACTER_IDS[index])];if(!from)return index;
 const candidates=positions.map((p,i)=>({p,i})).filter(({p,i})=>ids[i]&&(p.y-from.y)*direction>0);
 candidates.sort((a,b)=>Math.abs(a.p.y-from.y)-Math.abs(b.p.y-from.y)||Math.abs(a.p.x-from.x)-Math.abs(b.p.x-from.x));
 return candidates.length?CHARACTER_IDS.indexOf(ids[candidates[0].i] as typeof CHARACTER_IDS[number]):index;
}
