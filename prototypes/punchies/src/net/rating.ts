export interface RatingIdentity {myId:string;token:string;rating:number;matches:number}
export interface RatingResult {state:'pending'|'settled'|'expired';rating:number;matches:number;delta:number}
export type RatingServiceState = {status:'unconfigured'|'loading'|'error'} | {status:'ready';rating:number;matches:number};
interface PendingReport {matchId:string;score:0|.5|1;quit:boolean;expires:number}
interface SavedIdentity extends RatingIdentity {pending?:PendingReport[]}
const configuredUrl=(import.meta.env.VITE_PUNCHIES_RATING_URL as string|undefined)?.replace(/\/$/,'');
const key='punchies:rating:v1';
let identity:RatingIdentity|null=null, pending:PendingReport[]=[];
let state:RatingServiceState={status:configuredUrl?'loading':'unconfigured'};
let loading:Promise<RatingIdentity|null>|null=null;
const listeners=new Set<(state:RatingServiceState)=>void>();
export const ratingConfigured=()=>!!configuredUrl;
export const ratingServiceState=()=>({...state});
export function onRatingState(listener:(state:RatingServiceState)=>void){listeners.add(listener);listener(ratingServiceState());return ()=>listeners.delete(listener);}
function updateState(next:RatingServiceState){state=next;for(const listener of listeners)listener(ratingServiceState());}
class RatingError extends Error {constructor(public status:number){super('Rating request failed');}}
async function request<T>(path:string,body:unknown):Promise<T>{
 if(!configuredUrl)throw Error('Rating service unavailable');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
 try{const response=await fetch(configuredUrl+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});if(!response.ok)throw new RatingError(response.status);return await response.json() as T;}finally{clearTimeout(timer);}
}
const validId=(id:unknown):id is string=>typeof id==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id);
function validIdentity(v:unknown):v is SavedIdentity {const p=v as SavedIdentity;return !!p&&validId(p.myId)&&typeof p.token==='string'&&p.token.length===72&&Number.isSafeInteger(p.rating)&&p.rating>=0&&Number.isSafeInteger(p.matches)&&p.matches>=0;}
function validResult(r:RatingResult){return !!r&&['pending','settled','expired'].includes(r.state)&&Number.isSafeInteger(r.rating)&&r.rating>=0&&Number.isSafeInteger(r.matches)&&r.matches>=0&&Number.isSafeInteger(r.delta);}
function save(){if(identity)try{localStorage.setItem(key,JSON.stringify({...identity,pending}));}catch{/* Anonymous identity remains session-only if storage is unavailable. */}}
function applyResult(r:RatingResult){if(r.matches>=identity!.matches)Object.assign(identity!,{rating:r.rating,matches:r.matches});save();updateState({status:'ready',rating:identity!.rating,matches:identity!.matches});}
export function currentRating(){return state.status==='ready'?identity:null;}
export function loadRating():Promise<RatingIdentity|null>{
 if(loading)return loading;
 loading=(async()=>{
  if(!configuredUrl){updateState({status:'unconfigured'});return null;}
  updateState({status:'loading'});
  try{
   if(!identity){try{const stored=JSON.parse(localStorage.getItem(key)??'null');if(validIdentity(stored)){identity={myId:stored.myId,token:stored.token,rating:stored.rating,matches:stored.matches};pending=(stored.pending??[]).filter(p=>validId(p.matchId)&&[0,.5,1].includes(p.score)&&typeof p.quit==='boolean'&&(!p.quit||p.score===0)&&Number.isFinite(p.expires));}}catch{/* New player or invalid local save. */}}
   if(!identity){const myId=crypto.randomUUID();identity={myId,...await request<Omit<RatingIdentity,'myId'>>('/register',{myId})};}
   else Object.assign(identity,await request('/rating',{myId:identity.myId,token:identity.token}));
   if(!validIdentity(identity))throw Error('Invalid rating response');
   save();updateState({status:'ready',rating:identity.rating,matches:identity.matches});
   await flushRatingReports();return identity;
  }catch{updateState({status:'error'});return null;}
 })().finally(()=>{loading=null;});return loading;
}
export async function createRatingMatch(opponent:string,nonce:string):Promise<string|null>{
 const me=await loadRating();if(!me||!validId(opponent)||!validId(nonce))return null;
 try{const result=await request<{matchId:string}>('/match',{myId:me.myId,token:me.token,opponent,nonce});return validId(result.matchId)?result.matchId:null;}catch{updateState({status:'error'});return null;}
}
async function sendReport(p:PendingReport):Promise<RatingResult|null>{
 if(!identity)return null;
 try{
  const result=await request<RatingResult>('/report',{myId:identity.myId,token:identity.token,...p});
  if(!validResult(result))throw Error('Invalid rating response');
  if(result.state!=='pending')pending=pending.filter(q=>q.matchId!==p.matchId);
  applyResult(result);return result;
 }catch(error){
  // An immutable-conflict response cannot be repaired by changing the claim.
  if(error instanceof RatingError&&[400,404,409].includes(error.status)){pending=pending.filter(q=>q.matchId!==p.matchId);save();}
  updateState({status:'error'});return null;
 }
}
export async function reportRating(matchId:string,score:0|.5|1,quit=false):Promise<RatingResult|null>{
 if(!identity||!validId(matchId)||![0,.5,1].includes(score)||(quit&&score!==0))return null;
 let report=pending.find(p=>p.matchId===matchId);
 if(report&&(report.score!==score||report.quit!==quit))return null;
 if(!report){report={matchId,score,quit,expires:Date.now()+600000};pending.push(report);save();}
 return sendReport(report);
}
export async function flushRatingReports():Promise<void>{
 if(!identity)return;
 pending=pending.filter(p=>p.expires>Date.now());save();
 for(const report of [...pending])await sendReport(report);
}
export async function ratingStatus(matchId:string):Promise<RatingResult|null>{
 if(!identity||!validId(matchId))return null;
 try{
  const queued=pending.find(p=>p.matchId===matchId);
  if(queued){const retry=await sendReport(queued);if(retry)return retry;}
  const result=await request<RatingResult>('/status',{myId:identity.myId,token:identity.token,matchId});
  if(!validResult(result))throw Error('Invalid rating response');
  if(result.state!=='pending')pending=pending.filter(p=>p.matchId!==matchId);
  applyResult(result);return result;
 }catch{updateState({status:'error'});return null;}
}
