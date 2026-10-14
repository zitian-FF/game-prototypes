import {DAILY_CAP,MAX_BYTES,MAX_SESSION_EVENTS,RETENTION_DAYS,byteSize,validBatch,type Batch} from '../../src/analytics/schema';
interface Statement {bind(...args:unknown[]):Statement;run():Promise<unknown>;all<T=Record<string,unknown>>():Promise<{results:T[]}>}
interface Database {prepare(sql:string):Statement;batch(statements:Statement[]):Promise<unknown[]>}
export interface Env {DB:Database;REPORT_TOKEN:string}
const reply=(body:unknown,status=200,origin?:string)=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...(origin?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{})}});
export function allowedOrigin(origin:string|null):origin is string{return !!origin&&(origin==='https://html-classic.itch.zone'||/^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(origin));}
/** Each INSERT and its count trigger are atomic; batch() is a D1 transaction. */
export function ingestionStatements(db:Database,batch:Batch,now:number):Statement[]{
 const day=new Date(now*1000).toISOString().slice(0,10);
 return [db.prepare('INSERT OR IGNORE INTO sessions(sid,pid,first_at,last_at,count) SELECT ?,?,?,?,0 WHERE COALESCE((SELECT count FROM daily_caps WHERE day=?),0) < ?').bind(batch.sid,batch.pid,now,now,day,DAILY_CAP),
 ...batch.events.map(event=>db.prepare(`INSERT OR IGNORE INTO events(received_at,sid,pid,edition,build,n,t,e,p_json)
 SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM sessions WHERE sid=? AND pid=? AND count<?)
 AND COALESCE((SELECT count FROM daily_caps WHERE day=?),0)<?`).bind(now,batch.sid,batch.pid,batch.edition,batch.build,event.n,event.t,event.e,JSON.stringify(event.p),batch.sid,batch.pid,MAX_SESSION_EVENTS,day,DAILY_CAP))];
}
export const FUNNEL=['boot_done','lang_chosen','firstfight_start','firstfight_hit','firstfight_done','reveal_ack','menu_view','mode_pick','select_confirm','match_start','match_end','second_match_start','tutorial_step'] as const;
export function funnelSteps(rows:{e:string;sessions:number}[]){let previous=0;return FUNNEL.map((event,index)=>{const sessions=Number(rows.find(row=>row.e===event)?.sessions??0),dropoff=index?Math.max(0,previous-sessions):0;const result={event,sessions,dropoff,dropoffRate:index&&previous?dropoff/previous:0};previous=sessions;return result;});}
export async function retention(db:Database,now:number):Promise<void>{const cutoff=now-RETENTION_DAYS*86400;await db.batch([db.prepare('DELETE FROM events WHERE received_at<?').bind(cutoff),db.prepare('DELETE FROM sessions WHERE last_at<?').bind(cutoff),db.prepare('DELETE FROM daily_caps WHERE day<?').bind(new Date(cutoff*1000).toISOString().slice(0,10))]);}
async function readLimited(request:Request):Promise<string|null>{
 const length=request.headers.get('Content-Length');if(length&&(!/^\d+$/.test(length)||Number(length)>MAX_BYTES))return null;
 if(!request.body)return null;const reader=request.body.getReader();let size=0;const chunks:Uint8Array[]=[];
 while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;if(size>MAX_BYTES){await reader.cancel();return null;}chunks.push(chunk.value);}
 const data=new Uint8Array(size);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.byteLength;}return new TextDecoder('utf-8',{fatal:true}).decode(data);
}

/** Dashboard reports are private; only the canonical Pages origin and local QA can read via CORS. */
export function allowedReportOrigin(origin:string|null):boolean{return origin===null||origin==='https://zitian-ff.github.io'||!!origin&&/^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(origin);}
async function playersReport(env:Env,from:number,limit:number,offset:number){
 const [total,players]=await Promise.all([
  env.DB.prepare('SELECT COUNT(DISTINCT pid) AS total FROM events WHERE received_at>=?').bind(from).all<{total:number}>(),
  env.DB.prepare(`WITH scoped AS (SELECT * FROM events WHERE received_at>=?), summary AS (
   SELECT pid,COUNT(DISTINCT sid) AS sessions,MAX(received_at) AS lastSeen,
    SUM(CASE WHEN e='match_end' AND json_extract(p_json,'$.result') IN ('win','lose','draw') THEN 1 ELSE 0 END) AS observedMatchEnds,
    SUM(CASE WHEN e='beta_completion' THEN 1 ELSE 0 END) AS observedSavedCompletions,
    MAX(CASE WHEN e='beta_completion' THEN json_extract(p_json,'$.roxy') END) AS roxyMilestoneObserved,
    MAX(CASE WHEN e='beta_completion' THEN json_extract(p_json,'$.nadia') END) AS nadiaMilestoneObserved
   FROM scoped GROUP BY pid), snapshots AS (
   SELECT pid,p_json,received_at,ROW_NUMBER() OVER(PARTITION BY pid ORDER BY received_at DESC,id DESC) AS rank FROM scoped WHERE e='beta_completion')
  SELECT a.*,json_extract(b.p_json,'$.completed') AS reportedCompletedMatches,json_extract(b.p_json,'$.wins') AS reportedWins,
   json_extract(b.p_json,'$.roxy') AS reportedRoxyUnlocked,json_extract(b.p_json,'$.nadia') AS reportedNadiaUnlocked,b.received_at AS snapshotAt
  FROM summary a LEFT JOIN snapshots b ON a.pid=b.pid AND b.rank=1 ORDER BY a.lastSeen DESC,a.pid LIMIT ? OFFSET ?`).bind(from,limit,offset).all()
 ]);return {totalProfiles:Number(total.results[0]?.total??0),limit,offset,profiles:players.results,coverageNote:'Anonymous browser profiles, not named people. Saved completion events are deduplicated per profile/match UUID. Reported totals and unlocks are local-save snapshots, not verified ownership; earlier saves, opt-outs, caps and retention can leave coverage incomplete. Missing snapshots are unknown.'};
}

export default {
 async fetch(request:Request,env:Env):Promise<Response>{
  const url=new URL(request.url),origin=request.headers.get('Origin');
  if(url.pathname==='/health'&&request.method==='GET')return reply({ok:true,edition:'itchbeta'});
  if(url.pathname==='/v1/events'){
   if(!allowedOrigin(origin))return reply({error:'origin'},403);
   if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600','Vary':'Origin'}});
   if(request.method!=='POST')return reply({error:'method'},405,origin);
   if(!/^(text\/plain|application\/json)(;|$)/i.test(request.headers.get('Content-Type')??''))return reply({error:'content_type'},415,origin);
   try{const text=await readLimited(request);if(text===null||byteSize(text)>MAX_BYTES)return reply({error:'size'},413,origin);let batch:unknown;try{batch=JSON.parse(text);}catch{return reply({error:'schema'},400,origin);}if(!validBatch(batch))return reply({error:'schema'},400,origin);await env.DB.batch(ingestionStatements(env.DB,batch,Math.floor(Date.now()/1000)));return reply({ok:true},200,origin);}catch{return reply({error:'unavailable'},503,origin);}
  }
  if(url.pathname==='/v1/funnel'||url.pathname==='/v1/players'){
   if(!allowedReportOrigin(origin))return reply({error:'origin'},403);
   if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...(origin?{'Access-Control-Allow-Origin':origin}:{}),'Access-Control-Allow-Methods':'GET','Access-Control-Allow-Headers':'Authorization','Access-Control-Max-Age':'600','Vary':'Origin'}});
   if(request.method!=='GET')return reply({error:'method'},405,origin??undefined);
   const reportOrigin=origin??undefined;
   if(!env.REPORT_TOKEN||request.headers.get('Authorization')!==`Bearer ${env.REPORT_TOKEN}`)return reply({error:'auth'},401,reportOrigin);
   const playerRoute=url.pathname==='/v1/players',allowed=playerRoute?['days','limit','offset']:['days'];
   if([...url.searchParams.keys()].some(key=>!allowed.includes(key)))return reply({error:'query'},400,reportOrigin);
   const days=Number(url.searchParams.get('days')??7);if(!Number.isSafeInteger(days)||days<1||days>60)return reply({error:'days'},400,reportOrigin);
   const limit=Number(url.searchParams.get('limit')??100),offset=Number(url.searchParams.get('offset')??0);
   if(!Number.isSafeInteger(limit)||limit<1||limit>100||!Number.isSafeInteger(offset)||offset<0||offset>1000000)return reply({error:'pagination'},400,reportOrigin);
   const from=Math.floor(Date.now()/1000)-days*86400;
   try{
    if(playerRoute)return reply({days,generatedAt:Math.floor(Date.now()/1000),...await playersReport(env,from,limit,offset)},200,reportOrigin);
    const [reached,last,returns,counts,overview,results]=await Promise.all([
     env.DB.prepare('SELECT e,COUNT(DISTINCT sid) AS sessions FROM events WHERE received_at>=? GROUP BY e').bind(from).all<{e:string;sessions:number}>(),
     env.DB.prepare(`SELECT e,COUNT(*) AS sessions FROM (SELECT e,ROW_NUMBER() OVER(PARTITION BY sid ORDER BY n DESC) AS row FROM events WHERE received_at>=? AND e NOT IN ('perf','error','session_end')) WHERE row=1 GROUP BY e`).bind(from).all(),
     env.DB.prepare(`WITH activity AS (SELECT DISTINCT pid,date(received_at,'unixepoch') AS day FROM events WHERE received_at>=?) SELECT a.day,COUNT(DISTINCT a.pid) AS "returning" FROM activity a JOIN activity b ON a.pid=b.pid AND b.day=date(a.day,'-1 day') GROUP BY a.day ORDER BY a.day`).bind(from).all(),
     env.DB.prepare('SELECT e,COUNT(*) AS events,MAX(received_at) AS latestAt FROM events WHERE received_at>=? GROUP BY e').bind(from).all(),
     env.DB.prepare(`SELECT COUNT(*) AS events,COUNT(DISTINCT sid) AS sessions,COUNT(DISTINCT pid) AS profiles,MAX(received_at) AS latestAt,
      SUM(CASE WHEN e='match_end' AND json_extract(p_json,'$.result') IN ('win','lose','draw') THEN 1 ELSE 0 END) AS observedMatchEnds,
      SUM(CASE WHEN e='beta_completion' THEN 1 ELSE 0 END) AS observedSavedCompletions FROM events WHERE received_at>=?`).bind(from).all(),
     env.DB.prepare(`SELECT json_extract(p_json,'$.mode') AS mode,json_extract(p_json,'$.result') AS result,COUNT(*) AS events FROM events WHERE received_at>=? AND e='match_end' GROUP BY mode,result`).bind(from).all()
    ]);return reply({days,generatedAt:Math.floor(Date.now()/1000),overview:overview.results[0],eventCounts:counts.results,matchResults:results.results,steps:funnelSteps(reached.results),lastSessionEvents:last.results,nextDayReturns:returns.results,cohortNote:'Step reach counts are independent; returning sessions and skipped intro steps may increase later counts. Profiles are anonymous browser IDs, not people; historical match-end events have no stable completion ID.'},200,reportOrigin);
   }catch{return reply({error:'unavailable'},503,reportOrigin);}
  }
  return reply({error:'route'},404);
 },
 async scheduled(_controller:unknown,env:Env):Promise<void>{await retention(env.DB,Math.floor(Date.now()/1000));}
};
