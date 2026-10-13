import {loadLayouts} from './layouts';
export type Modality='touch'|'keyboard'|'gamepad';
export type ModalitySource='touch'|'kb1'|'kb2'|'pad1'|'pad2';
/** Session only; never inferred from hardware presence or persisted. */
export class InputModality {
 kind:Modality='touch';source:ModalitySource='touch';revision=0;
 private pads=new Map<number,{id:string;buttons:boolean[];direction:string}>();
 register(source:ModalitySource){const kind=source==='touch'?'touch':source.startsWith('kb')?'keyboard':'gamepad';if(this.source!==source){this.source=source;this.kind=kind;this.revision++;}}
 poll(pads:readonly (Gamepad|null)[]){
  const present=new Set<number>();
  pads.forEach((p,i)=>{if(!p?.connected)return;present.add(i);const buttons=p.buttons.map(b=>b.pressed||b.value>.4),x=p.axes[0]??0,y=p.axes[1]??0;
   const previous=this.pads.get(i),magnitude=Math.max(Math.abs(x),Math.abs(y));
   const direction=magnitude>.65?(Math.abs(x)>Math.abs(y)?'x'+Math.sign(x):'y'+Math.sign(y)):magnitude>.35?previous?.direction??'':'';
   this.pads.set(i,{id:p.id,buttons,direction});
   if(previous?.id===p.id&&(buttons.some((v,n)=>v&&!previous.buttons[n])||(direction&&direction!==previous.direction)))this.register(i===1?'pad2':'pad1');
  });for(const i of this.pads.keys())if(!present.has(i))this.pads.delete(i);
 }
}
export const inputModality=new InputModality();
let installed=false;
export function installInputModality(){if(installed)return;installed=true;
 window.addEventListener('pointerdown',()=>inputModality.register('touch'),{capture:true,passive:true});
 window.addEventListener('keydown',e=>{if(e.repeat||e.isComposing||e.ctrlKey||e.metaKey||e.altKey)return;const target=e.target as HTMLElement|null;if(target?.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(target?.tagName??''))return;const layouts=loadLayouts();inputModality.register(Object.values(layouts.kb2).some(keys=>keys.includes(e.code))?'kb2':'kb1');},{capture:true});
}
export function pollInputModality(){try{inputModality.poll(Array.from(navigator.getGamepads?.()??[]));}catch{/* unavailable platform */}}
