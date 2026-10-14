import {rulesMock,tuneValidationMock,compatibleTune} from './lib-punchies-rules.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const sent=[],timers=[],reports=[],matches=[],joined=[];
let room,loads=0;
const source=ts.transpileModule(fs.readFileSync('prototypes/punchies/src/net/session.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const out={};
const me={myId:crypto.randomUUID(),rating:1000};
vm.runInNewContext(source,{exports:out,crypto,setTimeout:fn=>{timers.push(fn);return 1;},clearTimeout(){},require:id=>id==='./rules'?rulesMock:id==='../sim/tune'?tuneValidationMock:id==='trystero/nostr'?{
 joinRoom(config,name){joined.push(name);room={makeAction(){return {send:async(data,options)=>sent.push({data,options})};},leave(){}};return room;},getRelaySockets:()=>({})
}:id==='./rating'?{currentRating:()=>me,loadRating:async()=>{loads++;return me;},createRatingMatch:async(...args)=>{matches.push(args);return 'match';},releaseRatingPair:async()=>{},reportRating:async(...args)=>reports.push(args)}:
 {localWireProfile:()=>({alias:'Test'}),peerProfile:profile=>profile??{}}});
const host=new out.NetSession('ABC','host',undefined,true);let paired=0;host.onPaired=()=>paired++;
const near=crypto.randomUUID(),far=crypto.randomUUID();
host.handleCtl({k:'hello',controlMode:'modern',rules:rulesMock.simulationRules(),role:'guest',rated:true,rating:{id:far,points:1800}},'far');
host.handleCtl({k:'hello',controlMode:'modern',rules:rulesMock.simulationRules(),role:'guest',rated:true,rating:{id:near,points:1020}},'near');
assert.equal(paired,0);timers.pop()();assert.equal(paired,1);assert.equal(host.peerId,'near');assert.equal(host.peerRating.id,near);
assert(sent.some(s=>s.data.k==='full'&&s.options.target==='far'));assert(sent.some(s=>s.data.k==='paired'&&s.options.target==='near'));
const nonce=crypto.randomUUID();const initial=host.beginRating(nonce);assert.equal(matches.length,0,'rating waits for compatible start');host.send({k:'start',controlModes:['modern','modern'],controlHash:rulesMock.controlModesHash(['modern','modern']),rated:true,ratingNonce:nonce,round:1,delay:2,tune:compatibleTune,chars:['marco','mia']});await initial;assert.deepEqual(matches[0],[near,nonce]);await host.forfeit(1);assert.deepEqual(reports[0],['match',0,true]);
const guest=new out.NetSession('ABC','guest',undefined,true);guest.handleCtl({k:'hello',controlMode:'modern',rules:rulesMock.simulationRules(),role:'host',rated:true},'host');assert.equal(guest.peerId,null,'guests wait for selection');
guest.handleCtl({k:'paired',controlMode:'modern',rules:rulesMock.simulationRules(),rated:true,rating:{id:me.myId,points:1000}},'host');assert.equal(guest.peerId,'host');
guest.handleCtl({k:'start',controlModes:['modern','modern'],controlHash:rulesMock.controlModesHash(['modern','modern']),rated:true,ratingNonce:crypto.randomUUID(),round:1,delay:2,tune:compatibleTune,rules:rulesMock.simulationRules(),tuneHash:rulesMock.tuneSnapshotHash(compatibleTune),chars:['marco','mia']},'host');
const nextNonce=crypto.randomUUID();guest.handleCtl({k:'ratingSet',nonce:nextNonce},'host');guest.markRoundEnded();guest.send({k:'rematch',round:2});guest.handleCtl({k:'rematch',round:2,rules:rulesMock.simulationRules()},'host');assert(guest.markMatchStarted());await guest.ratingMatch;assert.deepEqual(matches.at(-1),[me.myId,nextNonce]);
const count=matches.length;guest.handleCtl({k:'ratingSet',nonce:crypto.randomUUID()},'stranger');assert.equal(matches.length,count);
const invalid=new out.NetSession('ABC','host',undefined,true);invalid.handleCtl({k:'hello',controlMode:'modern',rules:rulesMock.simulationRules(),role:'guest',rated:true,rating:{id:'not-an-id',points:-100}},'bad');timers.pop()();assert.equal(invalid.peerRating,null);
const spoof=new out.NetSession('ABC','guest');spoof.handleCtl({k:'paired',controlMode:'modern',rules:rulesMock.simulationRules(),rating:{id:me.myId,points:1000}},'stranger');assert.equal(spoof.peerId,null);
guest.leave();guest.handleCtl({k:'ratingSet',nonce:crypto.randomUUID()},'host');assert.equal(matches.length,count);
console.log('PASS: nearest waiting peer, selected guest handshake, nonce binding and self-reported forfeit');

// Legacy/default private rooms are casual: no registration, match, report or rating data.
const initialLoads=loads,initialMatches=matches.length,initialReports=reports.length;
const casual=new out.NetSession('DEF','host');room.onPeerJoin('casual-guest');await Promise.resolve();await Promise.resolve();
assert.equal(loads,initialLoads);assert.equal(sent.at(-1).data.rated,false);assert.equal(sent.at(-1).data.rating,undefined);
casual.handleCtl({k:'hello',controlMode:'modern',rules:rulesMock.simulationRules(),role:'guest',rating:{id:near,points:9000}},'legacy');timers.pop()();
assert.equal(casual.peerId,'legacy');assert.equal(casual.peerRating,null);
casual.markMatchStarted();await casual.beginRating(crypto.randomUUID());await casual.report(1);await casual.forfeit(2);
casual.handleCtl({k:'ratingSet',nonce:crypto.randomUUID()},'legacy');
assert.equal(matches.length,initialMatches);assert.equal(reports.length,initialReports);assert.equal(loads,initialLoads);
const ranked=new out.NetSession('XYZ','host',undefined,true);
ranked.handleCtl({k:'hello',controlMode:'modern',rules:rulesMock.simulationRules(),role:'guest'},'old-client');assert.equal(ranked.candidates.size,0);
ranked.handleCtl({k:'hello',controlMode:'modern',rules:rulesMock.simulationRules(),role:'guest',rated:false},'casual-client');assert.equal(ranked.candidates.size,0);
const casualGuest=new out.NetSession('DEF','guest');casualGuest.handleCtl({k:'hello',controlMode:'modern',rules:rulesMock.simulationRules(),role:'host'},'legacy-host');
casualGuest.handleCtl({k:'paired',controlMode:'modern',rules:rulesMock.simulationRules(),rated:true,rating:{id:near,points:1000}},'legacy-host');assert.equal(casualGuest.peerId,null);
casualGuest.handleCtl({k:'paired'},'legacy-host');assert.equal(casualGuest.peerId,null,'missing rules never becomes compatible');casualGuest.handleCtl({k:'hello',controlMode:'modern',rules:rulesMock.simulationRules(),role:'host'},'legacy-host');casualGuest.handleCtl({k:'paired',controlMode:'modern',rules:rulesMock.simulationRules()},'legacy-host');assert.equal(casualGuest.peerId,'legacy-host');assert.equal(casualGuest.rated,false);
console.log('PASS Ranked-only: casual/legacy registration, settlement, quit and rematch are unrated; mismatched modes cannot pair');

assert.ok(joined.includes('ranked-room-ABC'));assert.ok(joined.includes('room-DEF'));
const roomExports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/net/roomCode.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:roomExports,location:{origin:'http://localhost:5218',pathname:'/game'},URLSearchParams});
assert.equal(roomExports.roomUrl('ABC'),'http://localhost:5218/game?room=ABC');
assert.equal(roomExports.roomUrl('ABC',true),'http://localhost:5218/game?room=ABC&ranked=1');

const assignedNonce=crypto.randomUUID(),pairId=crypto.randomUUID();const automatic=new out.NetSession('private-room','host',undefined,true,{opponent:near,nonce:assignedNonce,pairId});
automatic.handleCtl({k:'hello',controlMode:'modern',rules:rulesMock.simulationRules(),role:'guest',rated:true,rating:{id:far,points:1000}},'intruder');assert.equal(automatic.peerId,null);
automatic.handleCtl({k:'hello',controlMode:'modern',rules:rulesMock.simulationRules(),role:'guest',rated:true,rating:{id:near,points:1000}},'expected');timers.pop()();assert.equal(automatic.peerId,'expected');
assert.equal(automatic.nextRatingNonce(),assignedNonce);assert.notEqual(automatic.nextRatingNonce(),assignedNonce,'reselect/rematch must not reuse original reward nonce');const prepared=automatic.beginRating(assignedNonce);automatic.send({k:'start',controlModes:['modern','modern'],controlHash:rulesMock.controlModesHash(['modern','modern']),rated:true,ratingNonce:assignedNonce,round:1,delay:2,tune:compatibleTune,chars:['marco','mia']});await prepared;assert.deepEqual(matches.at(-1),[near,assignedNonce,pairId]);
console.log('PASS authoritative assigned opponent, queue pair rating binding and fresh subsequent-match nonce');
