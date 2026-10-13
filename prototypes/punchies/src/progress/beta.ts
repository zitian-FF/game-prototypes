import {store} from '../portal/store';

/** Community edition only. Never reads or awards normal progression/economy. */
const KEY='punchies.community.completions.v1';
export type BetaMode='ai'|'local'|'online';
export interface BetaCompletion {
  /** Allocate once at series creation and carry unchanged through every round. */
  id:string;mode:BetaMode;completed:boolean;seriesComplete:boolean;
  forfeit:boolean;disconnected:boolean;qa:boolean;win:boolean;
}
interface Ledger {version:1;ids:string[]}
const validId=(id:unknown):id is string=>typeof id==='string'&&id.length>0&&id.length<=160&&/^[\w:.-]+$/.test(id);
function load():Ledger {
  try {const raw=JSON.parse(store.getItem(KEY)??'null');return {version:1,ids:raw?.version===1&&Array.isArray(raw.ids)?[...new Set<string>(raw.ids.filter(validId))]:[]};}
  catch{return {version:1,ids:[]};}
}
export function betaFighters(completed=load().ids.length):string[]{
  return ['marco','mia','bruno',...(completed>=3?['roxy']:[]),...(completed>=5?['nadia']:[])];
}
export function betaView(){const completed=load().ids.length;return {completed,fighters:betaFighters(completed),milestones:[{fighter:'roxy',required:3,unlocked:completed>=3},{fighter:'nadia',required:5,unlocked:completed>=5}]};}
/** Call once per new whole match/series, never on scene restart or round start. */
export function newBetaCompletionId():string{return 'series:'+crypto.randomUUID();}
export function recordBetaCompletion(outcome:BetaCompletion):boolean {
  if(!validId(outcome.id)||!['ai','local','online'].includes(outcome.mode)||outcome.completed!==true||outcome.seriesComplete!==true||outcome.forfeit!==false||outcome.disconnected!==false||outcome.qa!==false)return false;
  const ledger=load();if(ledger.ids.includes(outcome.id))return false;
  ledger.ids.push(outcome.id);
  try{store.setItem(KEY,JSON.stringify(ledger));return true;}catch{return false;}
}
