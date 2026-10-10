import initial from '../../punchies/tune.json';
import metadata from '../../punchies/tune.meta.json';
import { applyTuneJson, validateTuneJson } from '../../punchies/src/sim/tune';
import { punchCfg, CHARACTER_INFO, CHARACTER_IDS, type CharId } from '../../punchies/src/sim/character';
import {archetypeKeys,defaultArchetypes,readArchetypes} from '../../punchies/src/sim/workshopText';

export interface BaseRevision {version:number;savedAt:string;changes:{path:string;before:number;after:number}[]}
export interface BaseHistory {format:1;initial:Record<string,number>;versions:BaseRevision[]}
export type Doc = Omit<typeof initial,'balanceWorkshop'> & {balanceWorkshop?:{baseHistory?:BaseHistory;archetypes?:Record<string,string>}};
export {archetypeKeys};
export const archetypeValue=(doc:Doc,key:string):string=>readArchetypes(doc)[key]??defaultArchetypes[key]??'';
export function setArchetype(doc:Doc,key:string,value:string):void{
  const texts={...readArchetypes(doc),[key]:value.trim()};readArchetypes({balanceWorkshop:{archetypes:texts}});
  doc.balanceWorkshop={...doc.balanceWorkshop,archetypes:texts};
}
export const archetypeChanges=(base:Doc,draft:Doc):string[]=>archetypeKeys.filter(key=>archetypeValue(base,key)!==archetypeValue(draft,key));
export const saveChanges=(base:Doc,draft:Doc):string[]=>[...changes(base,draft),...archetypeChanges(base,draft)];
const bundled:Doc = structuredClone(initial);
const template:Doc = structuredClone(bundled);
delete template.balanceWorkshop;
export const defaults = ():Doc => structuredClone(bundled);
export const characters = [...CHARACTER_IDS];
export const names = CHARACTER_INFO;
export const punches = ['jab','cross','hook','uppercut'] as const;
export const meta = metadata as unknown as Record<string,{min:number;max:number;step:number;desc:string}>;
export const baseGroups=['health','stamina','stun','movement','body','hit','fatigue','stars','punches','guard','dodge'] as const;
export const basePaths=Object.keys(meta).filter(path=>path==='view.fighterScale'||baseGroups.some(group=>path.startsWith(`${group}.`)));
export function baseSnapshot(doc:Doc):Record<string,number>{return Object.fromEntries(basePaths.filter(path=>typeof getSafe(doc,path)==='number').map(path=>[path,get(doc,path)]));}
export function baseVersion(doc:Doc):number{const versions=doc.balanceWorkshop?.baseHistory?.versions;return versions?.[versions.length-1]?.version??0;}
function validateHistory(doc:Doc):void{
  if(doc.balanceWorkshop===undefined)return;
  if(!doc.balanceWorkshop||typeof doc.balanceWorkshop!=='object'||Array.isArray(doc.balanceWorkshop))throw Error('Invalid workshop metadata');
  const history=doc.balanceWorkshop?.baseHistory;
  if(history===undefined)return;
  if(!history||history.format!==1||!history.initial||typeof history.initial!=='object'||Array.isArray(history.initial)||!Array.isArray(history.versions))throw Error('Invalid Base history');
  const numeric=(record:Record<string,number>)=>Object.entries(record).every(([key,value])=>basePaths.includes(key)&&typeof value==='number'&&Number.isFinite(value));
  if(!numeric(history.initial))throw Error('Invalid initial Base values');
  history.versions.forEach((revision,index)=>{
    if(!revision||revision.version!==index+1||typeof revision.savedAt!=='string'||!Number.isFinite(Date.parse(revision.savedAt))||!Array.isArray(revision.changes)||!revision.changes.length)throw Error('Invalid Base revision');
    const paths=new Set<string>();
    for(const change of revision.changes){if(!change||!basePaths.includes(change.path)||paths.has(change.path)||typeof change.before!=='number'||typeof change.after!=='number'||!Number.isFinite(change.before)||!Number.isFinite(change.after)||change.before===change.after)throw Error('Invalid Base revision values');paths.add(change.path);}
  });
}
function recordBaseRevision(previous:Doc,next:Doc):void{
  const edited=changes(previous,next).filter(path=>basePaths.includes(path));
  if(!edited.length)return;
  const history=next.balanceWorkshop?.baseHistory??{format:1 as const,initial:baseSnapshot(previous),versions:[]};
  history.versions.push({version:history.versions.length+1,savedAt:new Date().toISOString(),changes:edited.map(path=>({path,before:get(previous,path),after:get(next,path)}))});
  next.balanceWorkshop={...next.balanceWorkshop,baseHistory:history};
}
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
      if(!value||typeof value!=='object'||!Object.prototype.hasOwnProperty.call(value,key))throw Error(`Missing ${path}${key}`);
      walk(v,(value as Record<string,unknown>)[key],`${path}${key}.`);
    }
  }
  walk(template,candidate,'');validateHistory(candidate);return candidate;
}
export function changes(base:Doc,draft:Doc):string[] {
  return Object.keys(meta).filter(path=>typeof getSafe(base,path)==='number'&&getSafe(base,path)!==getSafe(draft,path));
}
function getSafe(doc:Doc,path:string):unknown {return path.split('.').reduce<unknown>((o,k)=>o&&typeof o==='object'?(o as Record<string,unknown>)[k]:undefined,doc);}
/** Merge only edited numeric fields; preserve unrelated changes from Claude. */
export function mergeSave(base:Doc,draft:Doc,latest:Doc):Doc {
  const merged=structuredClone(latest);
  const conflicting=changes(base,draft).filter(path=>get(latest,path)!==get(base,path)&&get(latest,path)!==get(draft,path));
  conflicting.push(...archetypeChanges(base,draft).filter(key=>archetypeValue(latest,key)!==archetypeValue(base,key)&&archetypeValue(latest,key)!==archetypeValue(draft,key)));
  if(conflicting.length)throw Error(`File changed in the same fields: ${conflicting.join(', ')}. Reopen the file before saving; your draft remains available to download.`);
  for(const path of changes(base,draft))set(merged,path,get(draft,path));
  for(const key of archetypeChanges(base,draft))setArchetype(merged,key,archetypeValue(draft,key));
  // History is generated from the actual latest saved file, never from client metadata.
  recordBaseRevision(latest,merged);
  return parse(JSON.stringify(merged));
}
export function effective(doc:Doc,char:CharId,section:string,key:string):number {
  const c=doc.characters[char];
  if(section==='core'){
    const values={hp:doc.health.max*c.hp,stamina:doc.stamina.max*c.stamina,stun:doc.stun.threshold*c.stun,speed:doc.movement.speed*c.speed,regen:doc.stamina.regenIdlePerSec*c.regen};
    return values[key as keyof typeof values];
  }
  if(section==='defense'){
    const proportion=doc.body.proportions[char],scale=doc.view.fighterScale*proportion;
    if(key==='proportion')return proportion;
    if(key==='fighterScale')return scale;
    return doc.body[key as 'hurtRadius'|'coreRadius'|'vulnerableHurtRadius']*scale;
  }
  if((punches as readonly string[]).includes(section)){
    applyTuneJson(JSON.stringify(doc));
    const cfg=punchCfg(char,section as typeof punches[number]);
    if(key==='damage'&&section==='uppercut')return doc.punches.cross.damage*doc.punches.uppercut.crossDamageMult*cfg.damage;
    return cfg[key as keyof typeof cfg];
  }
  return get(doc,`${section}.${key}`);
}
/** Effective values for a neutral fighter: unit multipliers, zero frame offsets and unit body proportion. */
export function baseEffective(doc:Doc,section:string,key:string):number {
  if(section==='core')return ({hp:doc.health.max,stamina:doc.stamina.max,stun:doc.stun.threshold,speed:doc.movement.speed,regen:doc.stamina.regenIdlePerSec} as Record<string,number>)[key];
  if(section==='defense'){
    if(key==='proportion')return 1;
    if(key==='fighterScale')return doc.view.fighterScale;
    return get(doc,`body.${key}`)*doc.view.fighterScale;
  }
  if((punches as readonly string[]).includes(section)){
    if(section==='uppercut'&&key==='damage')return doc.punches.cross.damage*doc.punches.uppercut.crossDamageMult;
    const stored=get(doc,`punches.${section}.${key}`);
    const value=stored??(['fatigueBars','fatigueSpeedPerBar','fatigueDamagePerBar'].includes(key)?0:stored);
    return key==='reach'||key==='hitRadius'?value*doc.view.fighterScale:value;
  }
  return get(doc,`${section}.${key}`);
}
export function difference(value:number,base:number):string {
  const amount=value-base;
  return `${amount>0?'+':''}${Number(amount.toFixed(4))} (${delta(value,base)})`;
}
export function delta(value:number,base:number):string {
  if(base===0)return value===0?'0%':'— (Base = 0)';
  const percent=(value/base-1)*100;
  if(Math.abs(percent)<.05)return '0%';
  return `${percent>0?'+':''}${percent.toFixed(1)}%`;
}
