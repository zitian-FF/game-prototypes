/** Logical-pixel presentation bounds; never modifies charge cost or simulation. */
export function superMeterLayout(view:{cx:number;top:number;width:number},side:number,cost:number){
 const count=Math.max(1,Math.min(4,Math.round(cost))),sign=side===0?-1:1,inner=view.width*.20+12,spacing=20;
 const width=Math.max(76,(count-1)*spacing+22),cx=view.cx+sign*(inner+width/2),cy=view.top+70;
 return {count,cx,cy,bounds:{x:cx-width/2,y:cy-12,width,height:24},sockets:Array.from({length:count},(_,i)=>({x:cx+sign*(i-(count-1)/2)*spacing,y:cy}))};
}
