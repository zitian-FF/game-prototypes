import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const sent=[],timers=[],reports=[],matches=[];
let room;
const source=ts.transpileModule(fs.readFileSync('prototypes/punchies/src/net/session.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const out={};
const me={myId:crypto.randomUUID(),rating:1000};
vm.runInNewContext(source,{exports:out,setTimeout:fn=>{timers.push(fn);return 1;},clearTimeout(){},require:id=>id==='trystero/nostr'?{
 joinRoom(){room={makeAction(){return {send:async(data,options)=>sent.push({data,options})};},leave(){}};return room;},getRelaySockets:()=>({})
}:id==='./rating'?{currentRating:()=>me,loadRating:async()=>me,createRatingMatch:async(...args)=>{matches.push(args);return 'match';},reportRating:async(...args)=>reports.push(args)}:
 {localWireProfile:()=>({alias:'Test'}),peerProfile:profile=>profile??{}}});
const host=new out.NetSession('ABC','host');let paired=0;host.onPaired=()=>paired++;
const near=crypto.randomUUID(),far=crypto.randomUUID();
host.handleCtl({k:'hello',role:'guest',rating:{id:far,points:1800}},'far');
host.handleCtl({k:'hello',role:'guest',rating:{id:near,points:1020}},'near');
assert.equal(paired,0);timers.pop()();assert.equal(paired,1);assert.equal(host.peerId,'near');assert.equal(host.peerRating.id,near);
assert(sent.some(s=>s.data.k==='full'&&s.options.target==='far'));assert(sent.some(s=>s.data.k==='paired'&&s.options.target==='near'));
const nonce=crypto.randomUUID();await host.beginRating(nonce);assert.deepEqual(matches[0],[near,nonce]);await host.forfeit(1);assert.deepEqual(reports[0],['match',0,true]);
const guest=new out.NetSession('ABC','guest');guest.handleCtl({k:'hello',role:'host'},'host');assert.equal(guest.peerId,null,'guests wait for selection');
guest.handleCtl({k:'paired',rating:{id:me.myId,points:1000}},'host');assert.equal(guest.peerId,'host');
const nextNonce=crypto.randomUUID();guest.handleCtl({k:'ratingSet',nonce:nextNonce},'host');await guest.ratingMatch;assert.deepEqual(matches.at(-1),[me.myId,nextNonce]);
const count=matches.length;guest.handleCtl({k:'ratingSet',nonce:crypto.randomUUID()},'stranger');assert.equal(matches.length,count);
const invalid=new out.NetSession('ABC','host');invalid.handleCtl({k:'hello',role:'guest',rating:{id:'not-an-id',points:-100}},'bad');timers.pop()();assert.equal(invalid.peerRating,null);
const spoof=new out.NetSession('ABC','guest');spoof.handleCtl({k:'paired',rating:{id:me.myId,points:1000}},'stranger');assert.equal(spoof.peerId,null);
guest.leave();guest.handleCtl({k:'ratingSet',nonce:crypto.randomUUID()},'host');assert.equal(matches.length,count);
console.log('PASS: nearest waiting peer, selected guest handshake, nonce binding and self-reported forfeit');
