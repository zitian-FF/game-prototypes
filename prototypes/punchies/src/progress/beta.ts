import {track} from '../portal/analytics';
import {store} from '../portal/store';
import {KEYS} from '../portal/keys';

/** Beta edition only. Never reads or awards normal progression/economy. */
export type BetaMode='ai'|'local'|'online';
export interface BetaCompletion {
  /** Allocate once at series creation and carry unchanged through every round. */
  id:string;mode:BetaMode;completed:boolean;seriesComplete:boolean;
  forfeit:boolean;disconnected:boolean;qa:boolean;win:boolean;
}
export interface BetaMatchRecord {id:string;mode:BetaMode;win:boolean}
interface Ledger {version:1;ids:string[];records:BetaMatchRecord[]}
const validId=(id:unknown):id is string=>typeof id==='string'&&id.length>0&&id.length<=160&&/^[\w:.-]+$/.test(id);
const validMode=(mode:unknown):mode is BetaMode=>mode==='ai'||mode==='local'||mode==='online';
function load():Ledger {
  if(!KEYS.betaCompletions)return {version:1,ids:[],records:[]};
  try {
    const raw=JSON.parse(store.getItem(KEYS.betaCompletions)??'null');
    const ids:string[]=raw?.version===1&&Array.isArray(raw.ids)?[...new Set<string>(raw.ids.filter(validId))]:[];
    const records:BetaMatchRecord[]=[];const seen=new Set<string>();
    if(raw?.version===1&&Array.isArray(raw.records))for(const record of raw.records){
      if(validId(record?.id)&&ids.includes(record.id)&&!seen.has(record.id)&&validMode(record.mode)&&typeof record.win==='boolean'){
        records.push({id:record.id,mode:record.mode,win:record.win});seen.add(record.id);
      }
    }
    return {version:1,ids,records};
  }catch{return {version:1,ids:[],records:[]};}
}
export function betaFighters(completed=load().ids.length):string[]{
  return ['marco','mia','bruno',...(completed>=3?['roxy']:[]),...(completed>=5?['nadia']:[])];
}
export function betaView(){const ledger=load(),completed=ledger.ids.length;return {completed,wins:ledger.records.filter(record=>record.win).length,records:ledger.records,fighters:betaFighters(completed),milestones:[{fighter:'roxy',required:3,unlocked:completed>=3},{fighter:'nadia',required:5,unlocked:completed>=5}]};}
/** Call once per new whole match/series, never on scene restart or round start. */
export function newBetaCompletionId():string{return 'series:'+crypto.randomUUID();}
export function recordBetaCompletion(outcome:BetaCompletion):boolean {
  if(!KEYS.betaCompletions||!validId(outcome.id)||!validMode(outcome.mode)||typeof outcome.win!=='boolean'||outcome.completed!==true||outcome.seriesComplete!==true||outcome.forfeit!==false||outcome.disconnected!==false||outcome.qa!==false)return false;
  const ledger=load();if(ledger.ids.includes(outcome.id))return false;
  ledger.ids.push(outcome.id);ledger.records.push({id:outcome.id,mode:outcome.mode,win:outcome.win});
  try{const json=JSON.stringify(ledger);store.setItem(KEYS.betaCompletions,json);if(store.getItem(KEYS.betaCompletions)!==json)return false;
    const completionId=/^(?:series|online):([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/.exec(outcome.id)?.[1];
    if(completionId)try{track('beta','beta_completion','event',{completion_id:completionId,completed:ledger.ids.length,wins:ledger.records.filter(record=>record.win).length,roxy:ledger.ids.length>=3,nadia:ledger.ids.length>=5,mode:outcome.mode,win:outcome.win});}catch{/* telemetry cannot change a saved match outcome */}
    return true;}catch{return false;}
}
