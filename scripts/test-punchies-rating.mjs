import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {rulesMock} from './lib-punchies-rules.mjs';
const compiled=await build({stdin:{contents:"export * from './prototypes/punchies/server/src/rating';export * from './prototypes/punchies/server/src/index';export {default as worker} from './prototypes/punchies/server/src/index';",resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false});
const m=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
assert.equal(m.kFactor({rating:1600,matches:0}),40);assert.equal(m.kFactor({rating:1400,matches:10}),24);assert.equal(m.kFactor({rating:1401,matches:10}),16);
assert.equal(m.farmFactor(100),1);assert(Math.abs(m.farmFactor(200)-.55)<1e-12);assert.equal(m.farmFactor(300),.1);
for(const rating of [0,5,1000,1400,1600])for(const other of [0,5,1000,1400,1600])for(const score of [0,.5,1]){
 const a={rating,matches:0},b={rating:other,matches:15},[da,db]=m.ratingChange(a,b,score);
 assert.equal(da+db,0);assert(rating+da>=0&&other+db>=0);assert(Number.isInteger(da));
 const reversed=m.ratingChange(b,a,1-score);assert.equal(da+reversed[0],0);
}
assert.deepEqual(m.ratingChange({rating:1000,matches:0},{rating:1000,matches:20},1),[20,-20]);
const db=new DatabaseSync(':memory:');
const sql={exec(query,...args){const stmt=db.prepare(query);return stmt.columns().length?stmt.all(...args):[stmt.run(...args)];}};
const store=new m.RatingStore({storage:{sql,transactionSync(fn){db.exec('BEGIN');try{const result=fn();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}}}});
const call=async(path,body)=>{const response=await store.fetch(new Request('https://rating.test'+path,{method:'POST',body:JSON.stringify(body)}));return {status:response.status,...await response.json()};};
const a={myId:crypto.randomUUID()},b={myId:crypto.randomUUID()};Object.assign(a,await call('/register',a));Object.assign(b,await call('/register',b));
assert.equal(a.rating,1000);assert.equal((await call('/rating',{...a,token:b.token})).status,401);
const nonce=crypto.randomUUID(),pair=await call('/match',{...a,opponent:b.myId,nonce});
assert.equal((await call('/match',{...b,opponent:a.myId,nonce})).matchId,pair.matchId);
const ra={...a,matchId:pair.matchId,score:1,quit:false},rb={...b,matchId:pair.matchId,score:0,quit:false};
assert.equal((await call('/report',ra)).state,'pending');assert.equal((await call('/report',ra)).state,'pending');
assert.equal((await call('/report',{...ra,score:0})).status,409);
const settled=await call('/report',rb);assert.equal(settled.state,'settled');assert.equal(settled.rating,980);
assert.equal((await call('/report',rb)).rating,980);assert.equal((await call('/status',ra)).rating,1020);
const second=await call('/match',{...a,opponent:b.myId,nonce:crypto.randomUUID()});assert.notEqual(second.matchId,pair.matchId);
await call('/report',{...ra,matchId:second.matchId});assert.equal((await call('/report',{...rb,score:1,matchId:second.matchId})).state,'pending');
const third=await call('/match',{...a,opponent:b.myId,nonce:crypto.randomUUID()});
assert.equal((await call('/report',{...ra,matchId:third.matchId,score:0,quit:true})).state,'settled');
const expired=await call('/match',{...a,opponent:b.myId,nonce:crypto.randomUUID()});db.prepare('UPDATE matches SET expires=0 WHERE id=?').run(expired.matchId);
assert.equal((await call('/report',{...ra,matchId:expired.matchId})).state,'expired');
assert.equal(m.agreedScore(null,null),null);assert.equal(m.agreedScore({score:0,quit:true},null),0);assert.equal(m.agreedScore(null,{score:0,quit:true}),1);
const env={RATINGS:{idFromName:()=>'',get:()=>store}};
assert.equal((await m.worker.fetch(new Request('https://rating.test/rating',{method:'POST',headers:{Origin:'https://evil.test'},body:JSON.stringify(a)}),env)).status,403);
assert.equal((await m.worker.fetch(new Request('https://rating.test/rating',{method:'POST',headers:{Origin:'https://polsia.itch.io'},body:JSON.stringify(a)}),env)).status,200);
assert.equal((await m.worker.fetch(new Request('https://rating.test/rating',{method:'POST',headers:{Origin:'http://localhost:5189'},body:'x'.repeat(5000)}),env)).status,413,'chunked requests enforce payload cap');

// Actual rating.ts client against the Worker handler + SQLite, with separate
// browser stores. Transport failures are injected; no replacement client logic.
function client(saved=new Map(),configured=true){
 let offline=false;
 const source=fs.readFileSync('prototypes/punchies/src/net/rating.ts','utf8').replace('import.meta.env.VITE_PUNCHIES_RATING_URL',configured?"'https://rating.test'":'undefined');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};
 vm.runInNewContext(code,{exports,crypto,AbortController,setTimeout,clearTimeout,console,
  require:path=>{if(path==='./rules')return rulesMock;if(path==='../portal/store')return {store:{getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v)}};if(path==='../portal/keys')return {KEYS:{rating:'punchies:rating:v1'}};throw Error(`Unexpected client import ${path}`);},
  fetch:async(url,options)=>{if(offline)throw Error('offline');return m.worker.fetch(new Request(url,{...options,headers:{...options.headers,Origin:'http://localhost:5189'}}),env);}});
 return {api:exports,saved,setOffline:value=>offline=value};
}
const ca=client(),cb=client();
const ia=await ca.api.loadRating(),ib=await cb.api.loadRating();
assert.equal(ia.rating,1000);assert.equal(ca.api.ratingServiceState().status,'ready');
assert.equal(await ca.api.createRatingMatch(ib.myId,crypto.randomUUID()),null,'modern client cannot bypass authenticated queue binding');
const qa=await ca.api.rankedQueue('join'),qb=await cb.api.rankedQueue('join');
assert.equal(qa.status,'waiting');assert.equal(qb.status,'paired');
const pa=await ca.api.rankedQueue('poll',qa.ticket);assert.equal(pa.status,'paired');assert.equal(pa.pairId,qb.pairId);assert.equal(pa.nonce,qb.nonce);
assert.deepEqual(pa.baseline,{local:1000,opponent:1000});
await ca.api.rankedQueue('complete',qa.ticket);await cb.api.rankedQueue('complete',qb.ticket);
const realNonce=pa.nonce,matchA=await ca.api.createRatingMatch(ib.myId,realNonce,pa.pairId),matchB=await cb.api.createRatingMatch(ia.myId,realNonce,qb.pairId);
assert(matchA,'actual modern compatible pair creates a match');
assert.equal(matchA,matchB);
ca.setOffline(true);assert.equal(await ca.api.reportRating(matchA,1),null);assert.equal(ca.api.ratingServiceState().status,'error');assert.equal(ca.api.currentRating(),null);
assert.equal(JSON.parse(ca.saved.get('punchies:rating:v1')).pending.length,1);
assert.equal((await cb.api.reportRating(matchB,0)).state,'pending');
const reloaded=client(ca.saved);await reloaded.api.loadRating();
assert.equal(reloaded.api.currentRating().rating,1020,'reloaded client retries its persisted report');
assert.equal(JSON.parse(ca.saved.get('punchies:rating:v1')).pending.length,0);
assert.equal((await cb.api.ratingStatus(matchB)).rating,980);assert.equal(cb.api.currentRating().matches,1);
assert.equal((await cb.api.reportRating(matchB,0)).rating,980,'re-report cannot settle twice');
const quitNonce=crypto.randomUUID(),quitMatch=await cb.api.createRatingMatch(ia.myId,quitNonce,qb.pairId);
await cb.api.reportRating(quitMatch,0,true);assert.equal((await reloaded.api.ratingStatus(quitMatch)).state,'settled');
const off=client(new Map(),false);assert.equal(await off.api.loadRating(),null);assert.equal(off.api.ratingServiceState().status,'unconfigured');
const badStore=new Map([['punchies:rating:v1','{"myId":"bad","token":"bad"}']]);const bad=client(badStore);assert.equal((await bad.api.loadRating()).rating,1000);
console.log('PASS: real client/Worker/SQLite integration, independent identities, network failure state, persisted report retry after reload, settlement persistence, quit, unavailable config and corrupt identity');
if(!process.argv.includes('--serve'))db.close();console.log('PASS: Elo bands, farming, symmetry, floor, SQLite settlement, nonce idempotency, token ownership, duplicate/disputed/missing reports, quit, expiry and origin policy');

if(process.argv.includes('--serve')){
 const {createServer}=await import('node:http');
 createServer(async(req,res)=>{
  const chunks=[];for await(const c of req)chunks.push(c);
  const request=new Request('http://127.0.0.1:5188'+req.url,{method:req.method,headers:req.headers,...(req.method==='POST'?{body:Buffer.concat(chunks)}:{})});
  const response=await m.worker.fetch(request,env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }).listen(5188,'127.0.0.1',()=>console.log('Local rating SQLite service http://127.0.0.1:5188'));
}
