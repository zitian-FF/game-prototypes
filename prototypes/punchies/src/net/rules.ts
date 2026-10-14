import {EDITION_ID,EDITION_POLICY_HASH,ITCH_BETA_EDITION} from '../edition';
import {CHARACTER_IDS} from '../sim/character';
import {superBalanceConfig} from '../sim/super';
/** Bump only for semantic simulation changes, never UI/art-only commits. */
export const SIM_RULES_VERSION='sim-modern-controls-7';
export interface RulesStamp {protocol:2;version:string;hash:string}
// Control lifecycle changes must also reject clients with the old BO3 gate.
const EDITION_RULES=EDITION_ID==='master'?[]:[EDITION_ID,EDITION_POLICY_HASH];
const CONTROL_RULES_VERSION='bo3-ready-2';
function canonical(value:unknown):string {
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical((value as Record<string,unknown>)[k])).join(',')+'}';
 return JSON.stringify(value);
}
function hash(value:unknown):string{let h=2166136261;const text=canonical(value);for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619)>>>0;return h.toString(16).padStart(8,'0');}
function simulationData(value:unknown):unknown {
 if(Array.isArray(value))return value.map(simulationData);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>key!=='nameKey'&&key!=='descriptionKey').map(([key,v])=>[key,simulationData(v)]));
 return value;
}
export function simulationRules():RulesStamp{return {protocol:2,version:SIM_RULES_VERSION,hash:hash([SIM_RULES_VERSION,CONTROL_RULES_VERSION,[...CHARACTER_IDS].sort(),simulationData(superBalanceConfig),...EDITION_RULES])};}
export function sameRules(value:unknown):boolean {const r=value as Partial<RulesStamp>|null,local=simulationRules();return !!r&&r.protocol===local.protocol&&r.version===local.version&&r.hash===local.hash;}
export const rulesFingerprint=()=>{const r=simulationRules();return r.version+':'+r.hash;};
/** Host tune is validated/synchronized separately; a different local tune is legal. */
export function tuneSnapshotHash(json:string):string|null{try{return hash(JSON.parse(json));}catch{return null;}}
export function validControlModes(value:unknown):value is ['modern'|'classic','modern'|'classic']{return Array.isArray(value)&&value.length===2&&value.every(mode=>mode==='modern'||mode==='classic');}
export const controlModesHash=(modes:unknown)=>validControlModes(modes)?hash(modes):null;

export function compatibleStart(value:unknown,rated:boolean,validate:(json:string)=>{ok:boolean}):boolean {
 const m=value as {rules?:unknown;tune?:unknown;tuneHash?:unknown;rated?:boolean;round?:unknown;delay?:unknown;chars?:unknown;skins?:unknown;ratingNonce?:unknown;controlModes?:unknown;controlHash?:unknown};
 if(!m||!validControlModes(m.controlModes)||m.controlHash!==controlModesHash(m.controlModes))return false;
 return !!m&&sameRules(m.rules)&&(m.rated===true)===rated&&typeof m.tune==='string'&&typeof m.tuneHash==='string'&&m.tuneHash===tuneSnapshotHash(m.tune)&&validate(m.tune).ok&&Number.isSafeInteger(m.round)&&Number(m.round)>0&&Number.isSafeInteger(m.delay)&&Number(m.delay)>=0&&Number(m.delay)<=60&&Array.isArray(m.chars)&&m.chars.length===2&&m.chars.every(id=>CHARACTER_IDS.includes(id))&&(!ITCH_BETA_EDITION||Array.isArray(m.skins)&&m.skins.length===2&&m.skins.every(skin=>skin==='default'))&&(!rated||(typeof m.ratingNonce==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(m.ratingNonce)));
}
