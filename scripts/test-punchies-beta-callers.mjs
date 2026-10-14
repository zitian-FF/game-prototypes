import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
function load(file,mocks={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/'+file+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,crypto,require:id=>mocks[id]??{}});return exports;}
const series=load('sim/series');
function harness(mode,qa=false){
 const saved=new Map(),store={getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value)};
 const ledger=load('progress/beta',{'../portal/store':{store},'../portal/keys':{KEYS:{betaCompletions:'beta-ledger'}}});
 const policy=load('editions/beta/policy',{'../../progress/beta':ledger,'../../edition':{ITCH_BETA_EDITION:true}});
 const progress=load('editions/beta/progress',{'../../progress/beta':ledger});
 let next,actions;const no=()=>{};
 class Stage{setSeries(){}}
 const sceneModule=load('scenes/'+(mode==='ai'?'VsAIScene':'LocalVsScene'),{
  phaser:{default:{Scene:class{}}},'../edition':{ITCH_BETA_EDITION:true},'../buildFlags':{STAGING_BUILD:qa,DEBUG_TOOLS_BUILD:qa},'../progress/beta':ledger,'../editions/beta/policy':policy,
  '../input/controlPreferences':{loadControlModes:()=>['modern','modern']},'../input/devices':{SOURCE_LABEL:{keyboard:'Keyboard'}},'../progress/progress':progress,'../sim/series':series,'../sim/tune':{tune:{match:{bestOf:3}},TICK_RATE:60},
  '../render/pixelRatio':{applyCameraPixelRatio:no},'../render/art':{fighterGroups:()=>[],whenGroupsReady:(_s,_g,ready)=>ready()},'./FightStage':{FightStage:Stage},'../version/versionStamp':{addVersionStamp:no},
  '../sim/sim':{createSimState:options=>({fighters:options.fighters,result:null})},'../sim/bot':{makeBot:()=>({})},'../sim/character':{charName:id=>id},'../i18n':{t:key=>key},'../portal/gameplay':{setGameplay:no},'../portal/analytics':{track:no},
  '../ui/presentation':{startScreen:no},'../ui/matchPresentation':{roundSplash:(_s,callback)=>{callback();return no;},matchResult:(_s,_title,a)=>{actions=a;return {};}}
 });
 const scene=new (mode==='ai'?sceneModule.VsAIScene:sceneModule.LocalVsScene)();scene.registry={set:no};scene.scene={restart:data=>{next=data;},isActive:()=>true};
 const initial={chars:['marco','mia'],skins:['default','default'],p1:'keyboard',p2:'keyboard'};
 scene.create(initial);
 return {scene,ledger,policy,saved,round(winner){scene.sim.result={winner};scene.showResult();if(next){const data=next;next=null;scene.create(data);}},rematch(){actions.rematch();const data=next;next=null;scene.create(data);}};
}
for(const mode of ['ai','local']){
 const h=harness(mode);assert(!h.policy.betaLineupAllowed(['roxy','marco']));
 const first=h.scene.betaCompletionId;h.round(0);assert.equal(h.ledger.betaView().completed,0);assert.equal(h.scene.betaCompletionId,first);h.round(1);assert.equal(h.ledger.betaView().completed,0);assert.equal(h.scene.betaCompletionId,first);h.round(0);assert.equal(h.ledger.betaView().completed,1);
 h.round(0);assert.equal(h.ledger.betaView().completed,1,'duplicate terminal callback cannot grant another match');
 for(const winners of [[1,1],[0,0],[1,1],[1,1]]){const previous=h.scene.betaCompletionId;h.rematch();assert.notEqual(h.scene.betaCompletionId,previous);for(const winner of winners)h.round(winner);}
 assert.equal(h.ledger.betaView().completed,5);assert.equal(h.ledger.betaView().wins,2);assert(h.policy.betaLineupAllowed(['roxy','nadia']));assert(!h.policy.betaLineupAllowed(['marco','mia'],['skin-marco-cyan','default']));
 assert.deepEqual([...h.saved.keys()],['beta-ledger'],'no XP/economy keys written');
 h.rematch();h.round(0);assert.equal(h.ledger.betaView().completed,5,'unfinished round/quit never grants');
 const qa=harness(mode,true);qa.round(0);qa.round(0);assert.equal(qa.ledger.betaView().completed,0,'QA whole-set outcomes excluded');
}
console.log('PASS actual AI/local scene callers: stable BO3 ID through rounds, one terminal count, fresh rematch IDs, losses/wins3/5, no XP/economy writes, incomplete/QA excluded');

