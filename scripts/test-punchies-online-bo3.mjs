import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
import {rulesMock,tuneValidationMock,compatibleTune} from './lib-punchies-rules.mjs';
import {EventEmitter} from 'node:events';
const source=fs.readFileSync('prototypes/punchies/src/net/session.ts','utf8');
const tick=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function peers(rated,modes=['modern','modern'],startChars=['tee','captain']){
 const rooms={},queue=[],timers=[],created=[],reports=[],ids={host:crypto.randomUUID(),guest:crypto.randomUUID()};
 const sessions={};
 for(const role of ['host','guest']){const exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,crypto,setTimeout:fn=>{timers.push(fn);return 1;},clearTimeout(){},require:id=>{
  if(id==='../edition')return {EDITION_ID:'master'};if(id==='./rules')return rulesMock;if(id==='../sim/tune')return tuneValidationMock;
  if(id==='../progress/profile')return {localWireProfile:()=>({alias:role,title:'rookie',level:1}),peerProfile:p=>p??{}};
  if(id==='./rating')return {currentRating:()=>({myId:ids[role],rating:1000}),loadRating:async()=>({myId:ids[role],rating:1000}),createRatingMatch:async(_other,nonce)=>{created.push({role,nonce});return 'match:'+nonce;},reportRating:async(id,score,quit)=>{reports.push({role,id,score,quit});return null;},releaseRatingPair:async()=>{}};
  if(id==='trystero/nostr')return {getRelaySockets:()=>({}),joinRoom:()=>{const room={makeAction:name=>{const channel={send:async(data)=>queue.push({from:role,to:role==='host'?'guest':'host',name,data})};room[name]=channel;return channel;},leave(){room.left=true;}};rooms[role]=room;return room;}};
  throw Error('unexpected import '+id);
 }});sessions[role]=new exports.NetSession('BO3',''+role,undefined,rated,undefined,modes[role==='host'?0:1]);}
 const deliver=(filter=()=>true)=>{for(let i=0;i<queue.length;){const p=queue[i];if(!filter(p)){i++;continue;}queue.splice(i,1);rooms[p.to][p.name].onMessage?.(p.data,{peerId:p.from});}};
 const begin=async()=>{rooms.host.onPeerJoin('guest');rooms.guest.onPeerJoin('host');await tick();deliver();timers.splice(0).forEach(fn=>fn());deliver();assert(sessions.host.readyForMatch&&sessions.guest.readyForMatch);
  const nonce=crypto.randomUUID();if(rated)void sessions.host.beginRating(nonce);sessions.host.send({k:'start',rated,round:1,delay:2,tune:compatibleTune,chars:startChars,skins:['default','default'],...(rated?{ratingNonce:nonce}:{})});deliver();if(rated)await sessions.guest.beginRating(nonce);await tick();assert(sessions.host.markMatchStarted());assert(sessions.guest.markMatchStarted());};
 return {sessions,rooms,queue,deliver,begin,created,reports};
}
for(const rated of [false,true])for(const first of ['host','guest']){
 const p=peers(rated);await p.begin();const other=first==='host'?'guest':'host';
 for(const next of [2,3]){
  p.sessions[first].markRoundEnded();p.sessions[first].send({k:'rematch',round:next});p.deliver();
  p.sessions[other].markRoundEnded();p.sessions[other].send({k:'rematch',round:next});p.deliver();
  assert.equal(p.sessions.host.markMatchStarted(),true,`host same-build BO3 round ${next}, rated=${rated}`);
  assert.equal(p.sessions.guest.markMatchStarted(),true,`guest same-build BO3 round ${next}, rated=${rated}`);
 }
 assert.equal(p.created.length,rated?2:0,'one rating identity per full BO3, not per round');
 assert.equal(p.reports.length,0,'round transition never claims a winner or forfeit');
}
console.log('PASS actual two-peer NetSession: host/guest early readiness, Ranked/Casual three-round continuation and one rating set identity.');
for(const modes of [['classic','modern'],['modern','classic'],['classic','classic']]){const p=peers(false,modes);await p.begin();for(const s of Object.values(p.sessions))assert.deepEqual(Array.from(s.controlModes),modes,'agreed immutable peer modes');
 for(const s of Object.values(p.sessions)){s.markRoundEnded();s.send({k:'rematch',round:2});}p.deliver();for(const s of Object.values(p.sessions)){assert(s.markMatchStarted());assert.deepEqual(Array.from(s.controlModes),modes,'BO3 mode lock');}
 const expected=Array.from(p.sessions.host.controlModes);p.sessions.host.send({k:'start',rated:false,round:3,delay:2,tune:compatibleTune,chars:['tee','captain'],controlModes:['modern','modern']});if(modes.some(m=>m==='classic'))assert.equal(p.sessions.host.readyForMatch,false,'cannot alter agreed modes through START');assert.deepEqual(Array.from(p.sessions.guest.controlModes),expected);}
// Reserving a new Ranked set after both rematch votes must not erase those votes.
{const p=peers(false);await p.begin();assert.equal(p.sessions.host.prepareNextMatchMode('classic',2),false,'no mode switch during an active set');p.sessions.host.markRoundEnded();p.sessions.host.markMatchCompleted();assert(p.sessions.host.prepareNextMatchMode('classic',2));p.deliver();assert.deepEqual(Array.from(p.sessions.guest.controlModes),['modern','modern'],'early proposal cannot change still-active peer mode');p.sessions.guest.markRoundEnded();p.sessions.guest.markMatchCompleted();for(const s of Object.values(p.sessions))s.send({k:'rematch',round:2});p.deliver();for(const s of Object.values(p.sessions)){assert(s.markMatchStarted());assert.deepEqual(Array.from(s.controlModes),['classic','modern'],'preference applies only to next full set');}}
{const p=peers(true);await p.begin();for(const s of Object.values(p.sessions)){s.markRoundEnded();s.markMatchCompleted();s.send({k:'rematch',round:2});}p.deliver();
 const nonce=crypto.randomUUID();p.sessions.host.send({k:'ratingSet',nonce});void p.sessions.host.beginRating(nonce);p.deliver();
 for(const s of Object.values(p.sessions))assert(s.markMatchStarted(),'new rating reservation preserves agreed rematch');await tick();assert.equal(p.created.length,4,'exactly one new identity per peer for rematched set');}

// Final round traffic is valid while one peer is still confirming its KO.
{const p=peers(false);await p.begin();let inputs=0,hashes=0;p.sessions.guest.onInputs=()=>inputs++;p.sessions.guest.onHash=()=>hashes++;p.sessions.guest.flushRoundTraffic();
 p.sessions.host.markRoundEnded();p.sessions.guest.markRoundEnded();p.sessions.host.sendInputs({round:1});p.sessions.host.sendHash({round:1});p.deliver();assert.equal(inputs,1);assert.equal(hashes,1);
 for(const s of Object.values(p.sessions))s.send({k:'rematch',round:2});p.deliver();for(const s of Object.values(p.sessions))assert(s.markMatchStarted());
 p.rooms.guest.inp.onMessage({round:1},{peerId:'host'});p.rooms.guest.inp.onMessage({round:3},{peerId:'host'});assert.equal(inputs,1,'old/future input never reaches the next round');
 p.sessions.host.send({k:'rematch',round:2});p.deliver();p.sessions.host.markRoundEnded();p.sessions.guest.markRoundEnded();for(const s of Object.values(p.sessions))s.send({k:'rematch',round:3});p.deliver();for(const s of Object.values(p.sessions))assert(s.markMatchStarted(),'stale readiness cannot reset next-round state');}
// A fast peer's first next-round ticks survive the slower peer's splash.
{const p=peers(false);await p.begin();let old=0;const received=[];p.sessions.guest.onInputs=()=>old++;p.sessions.guest.flushRoundTraffic();
 for(const s of Object.values(p.sessions)){s.markRoundEnded();s.send({k:'rematch',round:2});}p.deliver();assert(p.sessions.host.markMatchStarted());
 for(let from=0;from<80;from++)p.sessions.host.sendInputs({k:'inp',round:2,from,d:[[0,0,0]],adv:from});p.deliver();assert.equal(old,0,'future input never enters old rollback');
 assert(p.sessions.guest.markMatchStarted());p.sessions.guest.onInputs=packet=>received.push(packet.from);p.sessions.guest.flushRoundTraffic();assert.equal(received.length,64,'bounded transition queue');assert.equal(received[0],0,'earliest required tick retained');assert.equal(received.at(-1),63);p.sessions.guest.flushRoundTraffic();assert.equal(received.length,64,'drain once');}
for(const rated of [false,true]){const p=peers(rated);await p.begin();p.sessions.host.markRoundEnded();await Promise.all([p.sessions.host.forfeit(1),p.sessions.host.forfeit(1)]);assert.equal(p.queue.filter(x=>x.data.k==='forfeit').length,1);assert.equal(p.reports.length,rated?1:0,'intentional intermission quit stays unrated in Casual');}
{const p=peers(true);await p.begin();p.sessions.host.markMatchCompleted();await p.sessions.host.forfeit(1);assert.equal(p.reports.length,0,'finished set cannot become a new loss');}
{const p=peers(true);await p.begin();let left=0;p.sessions.host.onPeerLeft=()=>left++;p.rooms.host.onPeerLeave('guest');p.rooms.host.onPeerLeave('guest');assert.equal(left,1);assert(p.rooms.host.left);assert.equal(p.sessions.host.readyForMatch,false);assert.equal(p.reports.length,0,'transport disappearance is not a claimed win or local quit');}

function mod(file,mocks={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/'+file+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:id=>mocks[id]??{}});return exports;}
const series=mod('sim/series'),binding=mod('net/rankedResult');
function sceneHarness(role,p,beta=null){
 const exports={},splashes=[],transitions=[],exceptions=[],timers=[];let claims=0;
 class LS{constructor(_idx,_delay,_max,round,send){this.round=round;this.send=send;this.received=[];this.result=null;this.sim={tick:0,fighters:[{x:100,y:100},{x:200,y:100}]};this.rollbacks=0;this.rolledBackFrames=0;this.maxRollbackDepth=0;}receiveInputs(packet){if(packet.round===this.round)this.received.push(packet);}receiveHash(){}confirmedResult(){return this.result;}flushInputs(){this.send({k:'inp',round:this.round,from:0,d:[[0,0,0]],adv:0});}resolve(){return [];}canScheduleLocal(){return false;}canStep(){return false;}}
 class Stage{constructor(scene){scene.events.once('shutdown',()=>this.dead=true);}pollDevices(){if(this.dead)throw Error('disposed controls');}handleEvents(){}setSeries(){}draw(){}koFinished(){return true;}}
 const label=()=>({active:true,setOrigin(){return this;},setDepth(){return this;},setVisible(){return this;},setText(){return this;},setColor(){return this;}});
 const tune=JSON.parse(compatibleTune);tune.net.enhanced=0;
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/scenes/MatchScene.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,crypto,performance,require:id=>{
  if(id==='../edition')return {ITCH_BETA_EDITION:!!beta};if(id==='../buildFlags')return {STAGING_BUILD:false,DEBUG_TOOLS_BUILD:false};if(id==='../progress/beta')return beta??{};
  if(id==='phaser')return {default:{Scene:class{}}};if(id==='../sim/series')return series;if(id==='../net/rollback')return {Rollback:LS};
  if(id==='./FightStage')return {FightStage:Stage,makeButton(){}};
  if(id==='../render/pixelRatio')return {applyCameraPixelRatio(){},PIXEL_RATIO:1,VIEW:{cx:422,cy:195,left:0,top:0,width:844}};
  if(id==='../ui/presentation')return {startScreen:(_s,key,data)=>transitions.push({key,data})};
  if(id==='../ui/matchPresentation')return {roundSplash:(_s,next)=>{const item={next,cancelled:false};splashes.push(item);return ()=>item.cancelled=true;},matchResult:(_s,_h,_a,_score,_w,_kind,ranked)=>{ranked?.subscribe?.(()=>{});return label();}};
  if(id==='../net/rankedResult')return binding;
  if(id==='../net/rating')return {ratingConfigured:()=>p.sessions.host.rated,reportRating:async(id,score)=>{claims++;p.reports.push({role,id,score});return {state:'settled',outcome:{local:{before:1000,after:1000,delta:0,matches:1},opponent:{before:1000,after:1000,delta:0,matches:1}}};},ratingStatus:async()=>null};
  if(id==='../progress/profile')return {sideProfiles:()=>[{alias:'host',title:'rookie',level:1},{alias:'guest',title:'rookie',level:1}]};
  if(id==='../progress/progress')return beta?mod('editions/beta/progress',{'../../progress/beta':beta}):{awardMatch:()=>({}),progressView:()=>({title:'rookie'})};if(id==='../sim/tune')return {tune,TICK_RATE:60,restoreTune:value=>transitions.push({restore:value})};
  if(id==='../portal/gameplay')return {setGameplay(){}};if(id==='../portal/analytics')return {track(){}};if(id==='../ui/menuNav')return {getNav:()=>({engage(){}})};
  if(id==='../render/art')return {fighterGroups:()=>[],prefetchGroups(){}};if(id==='../sim/character')return {charName:id=>id,isCharId:id=>['marco','mia','bruno','roxy','nadia'].includes(id)};if(id==='../version/versionStamp')return {addVersionStamp(){}};if(id==='../i18n')return {t:k=>k};if(id==='../debug/debugPanel')return {isDebug:()=>false};return {};
 }});
 const scene=new exports.MatchScene();scene.events=new EventEmitter();scene.add={text:label};scene.registry={set(){}};
 scene.time={addEvent:cfg=>{const t={cfg,removed:false,remove(){this.removed=true;}};timers.push(t);return t;},delayedCall:(_delay,cb)=>({remove(){},cb}),removeAllEvents(){timers.forEach(t=>t.removed=true);}};
 scene.scene={isActive:()=>true,restart:data=>transitions.push({restart:data})};
 const data={session:p.sessions[role],localIdx:role==='host'?0:1,round:1,delay:2,chars:beta?['marco','mia']:['tee','captain'],skins:['default','default'],restoreTune:'original-local-tune'};
 const attempt=fn=>{try{fn();}catch(error){exceptions.push(error);}};
 return {scene,data,splashes,transitions,exceptions,attempt,get claims(){return claims;},restart(next){scene.events.emit('shutdown');attempt(()=>scene.create(next));}};
}
// Actual MatchScene KO/intermission/restart path on both peers, alternating winners.
for(const rated of [false,true])for(const early of ['host','guest']){
 const p=peers(rated);await p.begin();const h={host:sceneHarness('host',p),guest:sceneHarness('guest',p)};
 for(const s of Object.values(h))s.attempt(()=>s.scene.create(s.data));
 for(const winner of [0,1,0]){
  const late=early==='host'?'guest':'host';for(const s of Object.values(h))s.scene.ls.result={winner};
  h[early].attempt(()=>h[early].scene.showResult());p.deliver();h[late].attempt(()=>h[late].scene.showResult());p.deliver();
  if(winner===0&&h.host.scene.series.roundNumber===3)break;
  for(const role of ['host','guest']){const splash=h[role].splashes.at(-1);h[role].attempt(splash.next);const next=h[role].transitions.at(-1)?.restart;assert(next,'both peers prepare the same next round');h[role].restart(next);}
 }
 await tick();for(const s of Object.values(h)){assert.equal(s.exceptions.length,0,'capture actual scene exceptions');assert.equal(s.claims,rated?1:0,'one final set claim only');}assert.equal(p.created.length,rated?2:0);
}
// Pending splash and stale handlers cannot resurrect a lost match or touch a new one.
{const p=peers(false);await p.begin();const h={host:sceneHarness('host',p),guest:sceneHarness('guest',p)};for(const s of Object.values(h)){s.scene.create(s.data);s.scene.ls.result={winner:0};}
 // Both results happen before either control queue is delivered.
 h.host.scene.showResult();h.guest.scene.showResult();p.deliver();h.host.splashes.at(-1).next();h.host.restart(h.host.transitions.at(-1).restart);
 const packet={k:'inp',round:2,from:0,d:[[0,0,0]],adv:0};p.sessions.host.sendInputs(packet);p.deliver();assert.equal(h.guest.scene.ls.received.filter(x=>x.round===2).length,0);
 h.guest.splashes.at(-1).next();h.guest.restart(h.guest.transitions.at(-1).restart);assert.equal(h.guest.scene.ls.received.filter(x=>x.round===2&&x.from===0).length,1,'actual slower scene receives quarantined tick zero');
 p.rooms.guest.onPeerLeave('host');const before=h.guest.scene.ls.sim.tick;h.guest.attempt(()=>h.guest.scene.update(100,16));assert.equal(h.guest.scene.ls.sim.tick,before,'disconnect after resume is terminal');assert.equal(h.guest.exceptions.length,0);}
{const p=peers(false);await p.begin();const h=sceneHarness('host',p);h.scene.create(h.data);h.scene.ls.result={winner:0};h.scene.rematchRemote=true;h.scene.showResult();const pending=h.splashes[0];p.rooms.host.onPeerLeave('guest');h.attempt(pending.next);assert.equal(h.transitions.filter(t=>t.restart).length,0);const old=h.scene.ls.sim.tick;h.attempt(()=>h.scene.update(100,16));assert.equal(h.scene.ls.sim.tick,old);assert.equal(h.exceptions.length,0);}
{const p=peers(false);await p.begin();const h=sceneHarness('host',p);h.scene.create(h.data);const oldInput=p.sessions.host.onInputs,newCtl=()=>{};p.sessions.host.onCtl=newCtl;h.scene.events.emit('shutdown');assert.equal(p.sessions.host.onCtl,newCtl,'old shutdown preserves new scene handler');const before=h.scene.ls.received.length;oldInput({round:1});assert.equal(h.scene.ls.received.length,before,'late old callback is inert');}
// Rejected bootstrap remains safe even when Phaser reuses a disposed scene instance.
{const p=peers(false);await p.begin();const h=sceneHarness('host',p);h.scene.create(h.data);h.scene.events.emit('shutdown');p.sessions.host.markMatchStarted=()=>false;h.attempt(()=>h.scene.create({...h.data,round:2}));h.attempt(()=>h.scene.update(100,16));assert.equal(h.exceptions.length,0,'no stale-stage poll after rejected create');assert.equal(h.transitions.at(-1).key,'Menu');assert(h.transitions.some(t=>t.restore==='original-local-tune'));}
console.log('PASS actual MatchScene: alternating host/guest BO3 KO transitions, disconnect freezes, late splash/callback cleanup, rejected bootstrap safety, tune restore and no false/rerun rating claim.');

function betaFixture(){const state=new Map(),exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/progress/beta.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,crypto,require:id=>id==='../portal/keys'?{KEYS:{betaCompletions:'beta-ledger'}}:{store:{getItem:key=>state.get(key)??null,setItem:(key,value)=>state.set(key,value)}}});return exports;}
{const p=peers(false,['modern','modern'],['marco','mia']);await p.begin();const b={host:betaFixture(),guest:betaFixture()},h={host:sceneHarness('host',p,b.host),guest:sceneHarness('guest',p,b.guest)};for(const x of Object.values(h))x.scene.create(x.data);const ids={host:h.host.scene.match.betaCompletionId,guest:h.guest.scene.match.betaCompletionId};
 for(const [i,winner] of [0,1,0].entries()){for(const x of Object.values(h)){x.scene.ls.result={winner};x.attempt(()=>x.scene.showResult());}p.deliver();for(const role of ['host','guest']){assert.equal(h[role].exceptions.length,0);assert.equal(b[role].betaView().completed,i===2?1:0,'only whole online series grants');assert.equal(h[role].scene.match.betaCompletionId,ids[role]);}
 if(i<2)for(const role of ['host','guest']){h[role].splashes.at(-1).next();h[role].restart(h[role].transitions.at(-1).restart);}}
 assert.equal(b.host.betaView().wins,1);assert.equal(b.guest.betaView().wins,0);}
{const p=peers(false,['modern','modern'],['marco','mia']);await p.begin();const b=betaFixture(),h=sceneHarness('host',p,b);h.scene.create(h.data);h.scene.match.session.onPeerLeft();assert.equal(b.betaView().completed,0,'disconnect never grants a match');assert.equal(h.scene.terminal,true);}
console.log('PASS actual online Beta scene + real ledger: zero per-round grants, one whole-set ID/count, correct side wins, disconnect excluded');
