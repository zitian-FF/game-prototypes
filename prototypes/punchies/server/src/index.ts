import {RankedQueue} from './queue';
import {agreedScore,ratingChange,type Player,type Report,type Score} from './rating';
interface SQL {exec<T=Record<string,unknown>>(sql:string,...args:unknown[]):Iterable<T>}
interface State {storage:{sql:SQL;transactionSync<T>(fn:()=>T):T}}
interface Env {RATINGS:{idFromName(name:string):unknown;get(id:unknown):{fetch(request:Request):Promise<Response>}}}
interface Match {id:string;a:string;b:string;expires:number;reports:string;settled:number;deltas:string}
const validId=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v);
const json=(v:unknown,status=200)=>Response.json(v,{status});
const first=<T>(rows:Iterable<T>)=>Array.from(rows)[0];
export class RatingStore {
 private sql:SQL;
 private queue:RankedQueue;
 constructor(private state:State){
  this.sql=state.storage.sql;this.queue=new RankedQueue(this.sql);
  this.sql.exec('CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY, token TEXT NOT NULL, rating INTEGER NOT NULL, matches INTEGER NOT NULL)');
  this.sql.exec('CREATE TABLE IF NOT EXISTS matches (id TEXT PRIMARY KEY, a TEXT NOT NULL,b TEXT NOT NULL,nonce TEXT NOT NULL,expires INTEGER NOT NULL,reports TEXT NOT NULL,settled INTEGER NOT NULL DEFAULT 0,deltas TEXT NOT NULL DEFAULT "[]",UNIQUE(a,b,nonce))');
  this.sql.exec('CREATE TABLE IF NOT EXISTS match_snapshots(match TEXT PRIMARY KEY,players TEXT NOT NULL)');
 }
 private player(id:string):Player{return first(this.sql.exec<Player>('SELECT rating,matches FROM players WHERE id=?',id));}
 async fetch(request:Request):Promise<Response>{
  try{
   const body=await request.json() as Record<string,unknown>,path=new URL(request.url).pathname;
   if(!validId(body.myId))return json({error:'Invalid player'},400);
   const id=body.myId;
   if(path==='/register'){
    const existing=first(this.sql.exec<{token:string}>('SELECT token FROM players WHERE id=?',id));
    if(existing)return json({error:'Identity already exists'},409);
    const token=crypto.randomUUID()+crypto.randomUUID();
    this.sql.exec('INSERT INTO players VALUES(?,?,1000,0)',id,token);
    return json({token,...this.player(id)});
   }
   const owner=first(this.sql.exec<{token:string}>('SELECT token FROM players WHERE id=?',id));
   if(!owner||owner.token!==body.token)return json({error:'Invalid identity'},401);
   if(/^\/queue\/(join|poll|cancel|complete)$/.test(path))return this.state.storage.transactionSync(()=>json(this.queue.action(path.split('/')[2],id,body.ticket)));
   if(path==='/rating')return json(this.player(id));
   if(path==='/match'){
    if(!validId(body.opponent)||body.opponent===id||!validId(body.nonce)||!this.player(body.opponent))return json({error:'Invalid pair'},400);
    if(body.pairId!==undefined&&(typeof body.pairId!=='string'||!this.queue.authorize(id,body.opponent,body.pairId)))return json({error:'Invalid queue pair'},403);
    const [a,b]=[id,body.opponent].sort(),nonce=body.nonce;
    let match=first(this.sql.exec<Match>('SELECT * FROM matches WHERE a=? AND b=? AND nonce=?',a,b,nonce));
    if(!match){this.sql.exec('INSERT INTO matches(id,a,b,nonce,expires,reports) VALUES(?,?,?,?,?,?)',crypto.randomUUID(),a,b,nonce,Date.now()+600000,'{}');match=first(this.sql.exec<Match>('SELECT * FROM matches WHERE a=? AND b=? AND nonce=?',a,b,nonce));}
    return json({matchId:match.id,expires:match.expires});
   }
   if(path==='/report'||path==='/status')return this.state.storage.transactionSync(()=>{
    const match=first(this.sql.exec<Match>('SELECT * FROM matches WHERE id=?',body.matchId));
    if(!match||![match.a,match.b].includes(id))return json({error:'Invalid match'},404);
    const result=()=>{
     const saved=first(this.sql.exec<{players:string}>('SELECT players FROM match_snapshots WHERE match=?',match.id));
     const players=saved?JSON.parse(saved.players):null;
     return json({state:match.settled?'settled':Date.now()>match.expires?'expired':'pending',...this.player(id),delta:match.settled?JSON.parse(match.deltas)[id]:0,outcome:players?{local:players[id],opponent:players[id===match.a?match.b:match.a]}:null});
    };
    if(match.settled||Date.now()>match.expires||path==='/status')return result();
    if(![0,.5,1].includes(body.score as number)||typeof body.quit!=='boolean'||(body.quit&&body.score!==0))return json({error:'Invalid result'},400);
    const reports=JSON.parse(match.reports) as Record<string,Report>;
    const report={score:body.score as Score,quit:body.quit};
    if(reports[id]&&JSON.stringify(reports[id])!==JSON.stringify(report))return json({error:'Report is immutable'},409);
    reports[id]=report;
    this.sql.exec('UPDATE matches SET reports=? WHERE id=?',JSON.stringify(reports),match.id);
    const score=agreedScore(reports[match.a]??null,reports[match.b]??null);
    if(score!==null){
     const a=this.player(match.a),b=this.player(match.b),[da,db]=ratingChange(a,b,score);
     this.sql.exec('UPDATE players SET rating=rating+?,matches=matches+1 WHERE id=?',da,match.a);
     this.sql.exec('UPDATE players SET rating=rating+?,matches=matches+1 WHERE id=?',db,match.b);
     match.deltas=JSON.stringify({[match.a]:da,[match.b]:db});match.settled=1;
     this.sql.exec('INSERT INTO match_snapshots VALUES(?,?)',match.id,JSON.stringify({[match.a]:{before:a.rating,after:a.rating+da,delta:da,matches:a.matches+1},[match.b]:{before:b.rating,after:b.rating+db,delta:db,matches:b.matches+1}}));
     this.sql.exec('UPDATE matches SET settled=1,deltas=? WHERE id=?',match.deltas,match.id);
    }
    return result();
   });
   return json({error:'Unknown endpoint'},404);
  }catch{return json({error:'Invalid request'},400);}
 }
}
export default {
 async fetch(request:Request,env:Env):Promise<Response>{
  const origin=request.headers.get('Origin')??'';
  const allowed=/^https:\/\/([a-z0-9-]+\.)?(itch\.io|itch\.zone|crazygames\.com)$/.test(origin)||origin==='https://zitian-ff.github.io'||/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
  const headers={'Access-Control-Allow-Origin':allowed?origin:'null','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
  if(request.method==='OPTIONS')return new Response(null,{status:allowed?204:403,headers});
  if(request.method!=='POST'||!allowed)return new Response('Forbidden',{status:403,headers});
  if(Number(request.headers.get('Content-Length')??0)>4096)return new Response('Too large',{status:413,headers});
  const reader=request.body?.getReader(),chunks:Uint8Array[]=[];let size=0;
  if(reader){while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.length;if(size>4096){await reader.cancel();return new Response('Too large',{status:413,headers});}chunks.push(chunk.value);}}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const response=await env.RATINGS.get(env.RATINGS.idFromName('casual-v1')).fetch(new Request(request,{body:bytes}));
  return new Response(response.body,{status:response.status,headers:{...headers,'Content-Type':'application/json'}});
 }
};
