import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import {DatabaseSync} from 'node:sqlite';import path from 'node:path';
const db=new DatabaseSync(':memory:');let now=Date.now();const cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const exports={};cache.set(file,exports);vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,crypto,Response,Request,URL,Date:class extends Date{static now(){return now;}},require:id=>load(path.resolve(path.dirname(file),id+'.ts'))});return exports;}
const sql={exec(query,...args){const s=db.prepare(query);return /^SELECT/i.test(query)?s.all(...args):(s.run(...args),[]);}};
const {RatingStore}=load('prototypes/punchies/server/src/index.ts');const worker=new RatingStore({storage:{sql,transactionSync:fn=>{db.exec('BEGIN');try{const r=fn();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}}});
async function call(endpoint,identity,extras={},status=200){const r=await worker.fetch(new Request('https://worker'+endpoint,{method:'POST',body:JSON.stringify({...identity,...extras})}));assert.equal(r.status,status,endpoint);return r.json();}
async function player(rating){const p={myId:crypto.randomUUID()};Object.assign(p,await call('/register',p));sql.exec('UPDATE players SET rating=? WHERE id=?',rating,p.myId);p.rating=0;return p;}
const a=await player(1000),b=await player(1400),c=await player(1050);
const qa=await call('/queue/join',a),qb=await call('/queue/join',b),qc=await call('/queue/join',c);assert.equal(qa.status,'waiting');assert.equal(qb.status,'waiting');assert.equal(qc.status,'paired');assert.equal(qc.opponent,a.myId,'closest authoritative rating, not client-supplied rating');
const pa=await call('/queue/poll',a,{ticket:qa.ticket});assert.equal(pa.room,qc.room);assert.notEqual(pa.role,qc.role);assert.equal(pa.nonce,qc.nonce);
assert.deepEqual(pa.baseline,{local:1000,opponent:1050});assert.deepEqual(qc.baseline,{local:1050,opponent:1000});
sql.exec('UPDATE players SET rating=1001 WHERE id=?',a.myId);
assert.deepEqual((await call('/queue/poll',a,{ticket:qa.ticket})).baseline,pa.baseline,'pairing baseline is immutable');
assert.equal((await call('/queue/join',a)).ticket,qa.ticket,'one idempotent ticket per player');
assert.equal((await call('/queue/cancel',b,{ticket:qa.ticket})).status,'cancelled');assert.equal((await call('/queue/poll',a,{ticket:qa.ticket})).status,'paired','cannot cancel another player ticket');
await call('/queue/complete',a,{ticket:qa.ticket});await call('/queue/complete',c,{ticket:qc.ticket});
const m=await call('/match',a,{opponent:c.myId,nonce:pa.nonce,pairId:pa.pairId});const other=await call('/match',c,{opponent:a.myId,nonce:pa.nonce,pairId:pa.pairId});assert.equal(m.matchId,other.matchId);
await call('/match',b,{opponent:a.myId,nonce:pa.nonce,pairId:pa.pairId},403);
assert.equal((await call('/report',a,{matchId:m.matchId,score:1,quit:false})).outcome,null);
const settled=await call('/report',c,{matchId:m.matchId,score:0,quit:false});assert.equal(settled.state,'settled');
assert.equal(settled.outcome.opponent.before,1001);assert.equal(settled.outcome.local.before,1050);
assert.equal(settled.outcome.opponent.after-settled.outcome.opponent.before,settled.outcome.opponent.delta);
assert.equal(settled.outcome.local.matches,1);
await call('/status',b,{matchId:m.matchId},404);
sql.exec('UPDATE players SET rating=1200,matches=9 WHERE id=?',c.myId);
const later=await call('/status',c,{matchId:m.matchId});assert.deepEqual(later.outcome,settled.outcome,'later ratings cannot rewrite a match result');assert.equal(later.rating,1200);
sql.exec('DELETE FROM match_snapshots WHERE match=?',m.matchId);assert.equal((await call('/status',c,{matchId:m.matchId})).outcome,null,'legacy result unavailable');
const d=await player(1000),qd=await call('/queue/join',d);let pb;
for(let i=0;i<12;i++){now+=5000;pb=await call('/queue/poll',b,{ticket:qb.ticket});await call('/queue/poll',d,{ticket:qd.ticket});if(pb.status==='paired')break;}
assert.equal(pb.status,'paired','wait widens eligible Elo range');await call('/queue/cancel',b,{ticket:qb.ticket});assert.equal((await call('/queue/poll',d,{ticket:qd.ticket})).status,'cancelled','reservation cancellation releases both');
const e=await player(3000),qe=await call('/queue/join',e);now+=16000;assert.equal((await call('/queue/poll',e,{ticket:qe.ticket})).status,'cancelled','lease expires disconnected search');
const f=await player(4000),qf=await call('/queue/join',f);let pf;for(let i=0;i<18;i++){now+=5000;pf=await call('/queue/poll',f,{ticket:qf.ticket});}assert.equal(pf.status,'timeout');
await call('/queue/join',{...a,token:'bad'},{},401);
assert(/if\(rated\)\{startScreen\(this,'Lobby'/.test(fs.readFileSync('prototypes/punchies/src/scenes/MenuScene.ts','utf8')),'Ranked skips host/code UI');
console.log('PASS authenticated real SQLite queue: idempotence, closest Elo, widening, exclusive pair, foreign cancel rejection, expiry/timeout, shared private room/nonce, rating binding/settlement and Ranked UI gate');
db.close();
