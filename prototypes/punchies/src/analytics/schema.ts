/** Exact Beta wire contract. No arbitrary strings or personal data are accepted. */
export const MAX_EVENTS=50,MAX_BYTES=8192,MAX_SESSION_EVENTS=500,DAILY_CAP=5000,RETENTION_DAYS=60;
const modes=['vsai','localvs','online','training','tutorial'] as const;
const fighters=['marco','mia','bruno','roxy','nadia'] as const;
const controls=['modern','classic'] as const;
const languages=['en','ja','ko','zh','es','ar'] as const;
type Rule=readonly string[]|{min:number;max:number};
export const EVENT_PROPS:Record<string,Record<string,Rule>>={
 boot_done:{load:['fast','medium','slow'],input:['touch','desktop'],viewport:['small','medium','large']},
 lang_chosen:{language:languages},firstfight_start:{},firstfight_hit:{punch:['jab','cross','hook','uppercut']},
 firstfight_done:{result:['win','skip']},reveal_ack:{kind:['fighters','skins']},menu_view:{},
 mode_pick:{mode:modes},select_confirm:{mode:modes,fighter:fighters,side:{min:0,max:1},difficulty:['easy','medium','hard']},
 match_start:{mode:modes,control:controls,fighter:fighters},second_match_start:{mode:modes},
 match_end:{mode:modes,result:['win','lose','draw','quit','disconnect'],duration:['short','medium','long']},
 tutorial_step:{step:{min:1,max:30},control:controls},tutorial_done:{},
 pause:{mode:modes},settings_change:{setting:['control','audio','language'],control:controls},
 perf:{fps:['low','medium','high']},error:{type:['runtime','promise','load']},
 session_end:{duration:['short','medium','long']}
};
export interface WireEvent {n:number;t:number;e:string;p:Record<string,string|number|boolean>}
export interface Batch {v:1;edition:'itchbeta';build:string;sid:string;pid:string;events:WireEvent[]}
export const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v);
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const only=(v:Record<string,unknown>,keys:string[])=>Object.keys(v).every(k=>keys.includes(k));
export function validProps(event:string,value:unknown):value is WireEvent['p']{
 if(!object(value)||!Object.prototype.hasOwnProperty.call(EVENT_PROPS,event))return false;
 const rules=EVENT_PROPS[event];if(!only(value,Object.keys(rules)))return false;
 return Object.entries(value).every(([key,v])=>{const rule=rules[key];return Array.isArray(rule)?typeof v==='string'&&(rule as readonly string[]).includes(v):typeof v==='number'&&Number.isSafeInteger(v)&&v>=(rule as {min:number}).min&&v<=(rule as {max:number}).max;});
}
export function validBatch(value:unknown):value is Batch{
 if(!object(value)||!only(value,['v','edition','build','sid','pid','events'])||value.v!==1||value.edition!=='itchbeta'||typeof value.build!=='string'||!/^\d{6}r\d{4}$/.test(value.build)||!uuid(value.sid)||!uuid(value.pid)||!Array.isArray(value.events)||value.events.length<1||value.events.length>MAX_EVENTS)return false;
 const seen=new Set<number>();return value.events.every(ev=>{if(!object(ev)||!only(ev,['n','t','e','p'])||!Number.isSafeInteger(ev.n)||Number(ev.n)<1||Number(ev.n)>MAX_SESSION_EVENTS||!Number.isSafeInteger(ev.t)||Number(ev.t)<0||Number(ev.t)>86400000||typeof ev.e!=='string'||!validProps(ev.e,ev.p)||seen.has(Number(ev.n)))return false;seen.add(Number(ev.n));return true;});
}
export const byteSize=(value:string)=>new TextEncoder().encode(value).byteLength;
export const durationBucket=(ms:number)=>ms<60000?'short':ms<300000?'medium':'long';
