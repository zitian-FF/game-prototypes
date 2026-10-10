import initial from '../../punchies/tune.json';
import metadata from '../../punchies/tune.meta.json';
import { applyTuneJson, validateTuneJson } from '../../punchies/src/sim/tune';
import { punchCfg, CHARACTER_INFO, CHARACTER_IDS, type CharId } from '../../punchies/src/sim/character';

export type Doc = typeof initial;
const template = structuredClone(initial);
export const defaults = () => structuredClone(template);
export const characters = [...CHARACTER_IDS];
export const names = CHARACTER_INFO;
export const punches = ['jab','cross','hook','uppercut'] as const;
export const meta = metadata as unknown as Record<string,{min:number;max:number;step:number;desc:string}>;
export const get = (doc:Doc,path:string):number => path.split('.').reduce<unknown>((o,k)=>(o as Record<string,unknown>)[k],doc) as number;
export function set(doc:Doc,path:string,value:number):void {
  const range=meta[path];
  if(!range||!Number.isFinite(value)||value<range.min||value>range.max)throw Error(`Allowed range: ${range?.min} to ${range?.max}`);
  const parts=path.split('.'),key=parts.pop()!;
  const parent=parts.reduce<unknown>((o,k)=>(o as Record<string,unknown>)[k],doc) as Record<string,unknown>;
  if(typeof parent[key]!=='number')throw Error('Unknown tuning value');
  parent[key]=value;
}
export function parse(text:string):Doc {
  const result=validateTuneJson(text);if(!result.ok)throw Error(result.error);
  const candidate=JSON.parse(text);
  // Full files only: omitted fields must not silently revert to bundled defaults.
  function walk(schema:unknown,value:unknown,path:string){
    if(schema&&typeof schema==='object')for(const [key,v] of Object.entries(schema)){
      if(path===''&&key==='balanceWorkshop')continue; // Preserve optional editor provenance without treating it as game values.
      if(!value||typeof value!=='object'||!Object.prototype.hasOwnProperty.call(value,key))throw Error(`Missing ${path}${key}`);
      walk(v,(value as Record<string,unknown>)[key],`${path}${key}.`);
    }
  }
  walk(template,candidate,'');return candidate;
}
export function changes(base:Doc,draft:Doc):string[] {
  return Object.keys(meta).filter(path=>typeof getSafe(base,path)==='number'&&getSafe(base,path)!==getSafe(draft,path));
}
function getSafe(doc:Doc,path:string):unknown {return path.split('.').reduce<unknown>((o,k)=>o&&typeof o==='object'?(o as Record<string,unknown>)[k]:undefined,doc);}
/** Merge only edited numeric fields; preserve unrelated changes from Claude. */
export function mergeSave(base:Doc,draft:Doc,latest:Doc):Doc {
  const merged=structuredClone(latest);
  const conflicting=changes(base,draft).filter(path=>get(latest,path)!==get(base,path)&&get(latest,path)!==get(draft,path));
  if(conflicting.length)throw Error(`File changed in the same fields: ${conflicting.join(', ')}. Reopen the file before saving; your draft remains available to download.`);
  for(const path of changes(base,draft))set(merged,path,get(draft,path));
  return parse(JSON.stringify(merged));
}
export function effective(doc:Doc,char:CharId,section:string,key:string):number {
  const c=doc.characters[char];
  if(section==='core'){
    const values={hp:doc.health.max*c.hp,stamina:doc.stamina.max*c.stamina,stun:doc.stun.threshold*c.stun,speed:doc.movement.speed*c.speed,regen:doc.stamina.regenIdlePerSec*c.regen};
    return values[key as keyof typeof values];
  }
  if((punches as readonly string[]).includes(section)){
    applyTuneJson(JSON.stringify(doc));
    const cfg=punchCfg(char,section as typeof punches[number]);
    if(key==='damage'&&section==='uppercut')return doc.punches.cross.damage*doc.punches.uppercut.crossDamageMult*cfg.damage;
    return cfg[key as keyof typeof cfg];
  }
  return get(doc,`${section}.${key}`);
}
export function delta(value:number,base:number):string {
  if(base===0)return value===0?'0%':'— (Marco = 0)';
  const percent=(value/base-1)*100;
  if(Math.abs(percent)<.05)return '0%';
  return `${percent>0?'+':''}${percent.toFixed(1)}%`;
}



