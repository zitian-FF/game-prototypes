import assert from 'node:assert/strict';
const url=process.env.PUNCHIES_RATING_TEST_URL??'http://127.0.0.1:5188';
async function call(path,body){const r=await fetch(url+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://localhost:5189'},body:JSON.stringify(body)});assert.equal(r.status,200,`status ${r.status} on ${path}`);return r.json();}
const a={myId:crypto.randomUUID()},b={myId:crypto.randomUUID()};Object.assign(a,await call('/register',a));Object.assign(b,await call('/register',b));
assert.equal(a.rating,1000);assert.equal(b.rating,1000);
const nonce=crypto.randomUUID(),one=await call('/match',{...a,opponent:b.myId,nonce}),two=await call('/match',{...b,opponent:a.myId,nonce});assert.equal(one.matchId,two.matchId);
assert.equal((await call('/report',{...a,matchId:one.matchId,score:1,quit:false})).state,'pending');
assert.equal((await call('/report',{...b,matchId:one.matchId,score:0,quit:false})).state,'settled');
assert.equal((await call('/rating',a)).rating,1020);assert.equal((await call('/rating',b)).rating,980);
assert.equal((await call('/report',{...a,matchId:one.matchId,score:1,quit:false})).matches,1);
const next=await call('/match',{...a,opponent:b.myId,nonce:crypto.randomUUID()});assert.notEqual(next.matchId,one.matchId);
assert.equal((await call('/report',{...a,matchId:next.matchId,score:0,quit:true})).state,'settled');
assert.equal((await call('/status',{...b,matchId:next.matchId})).matches,2);
console.log('PASS real Wrangler/workerd SQLite DO: register, shared nonce, agreed settlement, points persistence, duplicate protection, rematch and explicit quit');
