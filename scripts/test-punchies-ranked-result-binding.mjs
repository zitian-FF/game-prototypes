import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/net/rankedResult.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,console});
const {rankedPlayers,rankedResultBinding}=exports;
const profiles=[{alias:'Host',title:'rookie',level:2},{alias:'Guest',title:'veteran',level:20}];
const snapshots={local:{before:1230,after:1248,delta:18,matches:4},opponent:{before:1270,after:1252,delta:-18,matches:9}};
const settled={state:'settled',rating:1248,matches:4,delta:18,outcome:snapshots};
const tick=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
for(const localIdx of [0,1]){
 const initial=rankedPlayers(profiles,localIdx,true,{local:1230,opponent:1270});assert.equal(initial[localIdx].rating.rating,1230);assert.equal(initial[1-localIdx].rating.rating,1270);
 let reports=0,reads=0;const jobs=[];const seen=[];
 const b=rankedResultBinding({players:initial,localIdx,configured:true,match:Promise.resolve('pinned-round-1'),report:async id=>{assert.equal(id,'pinned-round-1');reports++;return {state:'pending'};},status:async id=>{assert.equal(id,'pinned-round-1');reads++;return settled;},schedule:cb=>{jobs.push(cb);return ()=>{};}});
 const off=b.subscribe(p=>seen.push(p));await tick();assert.equal(reports,1);assert.equal(jobs.length,1);assert.equal(b.players[0].rating.phase,'pending');jobs.shift()();await tick();assert.equal(reads,1);assert.equal(jobs.length,0);assert.equal(b.players[localIdx].snapshot.after,1248);assert.equal(b.players[1-localIdx].snapshot.after,1252);assert.equal(b.players[localIdx].rating.delta,18);off();
}
// Endpoint disabled never calls the report/status API, even with seeded input.
{let requests=0;const b=rankedResultBinding({players:rankedPlayers(profiles,0,false,{local:1000,opponent:1000}),localIdx:0,configured:false,match:Promise.resolve('fake'),report:async()=>{requests++;},status:async()=>{requests++;},schedule:()=>()=>{}});b.subscribe(()=>{});await tick();assert.equal(requests,0);assert.equal(b.players[0].rating.phase,'unavailable');}
// A legacy settled response has no authoritative opponent snapshot. No fake delta.
{const b=rankedResultBinding({players:rankedPlayers(profiles,0,true),localIdx:0,configured:true,match:Promise.resolve('legacy'),report:async()=>({...settled,outcome:undefined}),status:async()=>null,schedule:()=>()=>{}});b.subscribe(()=>{});await tick();assert(b.players.every(p=>p.rating.phase==='unavailable'&&!p.snapshot));}
// Closing the result while a request is pending blocks late rendering and polling.
{let resolve,updates=0,polls=0;const b=rankedResultBinding({players:rankedPlayers(profiles,0,true),localIdx:0,configured:true,match:Promise.resolve('closing'),report:()=>new Promise(r=>resolve=r),status:async()=>settled,schedule:()=>{polls++;return ()=>{};}});const off=b.subscribe(()=>updates++);await tick();off();resolve({state:'pending'});await tick();assert.equal(updates,1);assert.equal(polls,0);}
// Polling is bounded and serial: at most eight status reads, never another report.
{let reports=0,reads=0;const jobs=[];const b=rankedResultBinding({players:rankedPlayers(profiles,0,true),localIdx:0,configured:true,match:Promise.resolve('waiting'),report:async()=>{reports++;return {state:'pending'};},status:async()=>{reads++;return {state:'pending'};},schedule:cb=>{jobs.push(cb);return ()=>{};}});b.subscribe(()=>{});await tick();while(jobs.length){jobs.shift()();await tick();}assert.equal(reports,1);assert.equal(reads,8);b.dispose();}
console.log('PASS ranked result: host/guest snapshots, pinned match ID, one report, bounded serial status polls, no fake/disabled ratings, legacy unavailable and late completion cleanup.');

// The real MatchScene submits against its captured promise, not a later rematch.
const sceneExports={},reported=[],transitions=[],shutdown=[];let presentation,latest,leaves=0;
vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/scenes/MatchScene.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:sceneExports,console,require:id=>{
 if(id==='phaser')return {default:{Scene:class{}}};
 if(id==='../net/rankedResult')return exports;
 if(id==='../net/rating')return {ratingConfigured:()=>true,reportRating:async(id,score)=>{reported.push({id,score});return settled;},ratingStatus:async()=>settled};
 if(id==='../progress/profile')return {sideProfiles:()=>profiles};
 if(id==='../sim/series')return {finishRound:()=>({complete:true,series:{wins:[2,0]}})};
 if(id==='../portal/gameplay')return {setGameplay(){}};
 if(id==='../portal/analytics')return {track(){}};
 if(id==='../progress/progress')return {awardMatch:()=>({}),progressView:()=>({title:'rookie'})};
 if(id==='../i18n')return {t:k=>k};
 if(id==='../ui/matchPresentation')return {matchResult:(_s,_h,_a,_score,_w,_kind,data)=>{presentation=data;data.subscribe(p=>latest=p);return {setText(){}};}};
 if(id==='../sim/tune')return {restoreTune:value=>transitions.push({restore:value})};
 if(id==='../ui/presentation')return {startScreen:(_s,key,data)=>transitions.push({key,data})};
 return {};
}});
const scene=new sceneExports.MatchScene();Object.assign(scene,{match:{localIdx:1,round:1,chars:['marco','mia'],restoreTune:'original',session:{rated:true,peer:profiles[0],assignment:{baseline:{local:1230,opponent:1270}},ratingMatch:Promise.resolve('future-round'),leave:()=>leaves++}},ratingMatchPromise:Promise.resolve('captured-round'),ls:{confirmedResult:()=>({winner:1})},stage:{setSeries(){}},waiting:{setVisible(){}},registry:{set(){}},events:{once:(_name,cb)=>shutdown.push(cb)},time:{delayedCall:()=>({remove(){}})}});
scene.showResult();await tick();assert.equal(reported.length,1);assert.equal(reported[0].id,'captured-round');assert.equal(reported[0].score,1);assert.equal(latest[1].snapshot.after,1248);assert.equal(presentation.localIdx,1);
presentation.nextMatch();presentation.nextMatch();assert.equal(leaves,1);assert.equal(transitions.at(-1).key,'Lobby');assert.equal(transitions.at(-1).data.rated,true);assert.equal(transitions.at(-2).restore,'original');shutdown.forEach(cb=>cb());
console.log('PASS actual MatchScene: one captured-round report, guest-side outcome, fresh Ranked queue, original tune restore, duplicate activation guard and shutdown cleanup.');
