import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const store=new Map();
const storage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)};
const ids=['marco','mia','bruno','tee'];
const character={CHARACTER_IDS:ids,isCharId:id=>ids.includes(id)};
const portalStore={store:{getItem:k=>storage.getItem(k)??null,setItem:(k,v)=>storage.setItem(k,v),removeItem:k=>storage.removeItem?.(k)}};
const portalKeys={KEYS:{audio:'punchies:audio:v1',shop:'punchies:shop-preview:v1',tutorial:'punchies:tutorial:v1',chars:'punchies:chars:v1',localInputs:'punchies:localInputs:v1'}};
function module(file,rawRequire) {
 const require=id=>id.includes('portal/store')?portalStore:id.includes('portal/keys')?portalKeys:id.includes('portal/gameplay')?{setGameplay(){},trackFightScene(){}}:id.includes('portal/index')?{loadingFinished(){},showRewardedAd:async()=>'rewarded',portal:{ads:{available:true,kind:'preview'}}}:rawRequire(id);
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require,localStorage:storage,Date,Math,Set,Number,JSON,Object,Array});return exports;
}
const palette=module('prototypes/punchies/src/render/skinPalette.ts',()=>({}));
const draft=module('prototypes/punchies/src/shop/draft.ts',p=>p.includes('skinPalette')?palette:({default:JSON.parse(fs.readFileSync('prototypes/punchies/src/shop/draft-config.json','utf8'))}));
const roster=module('prototypes/punchies/src/shop/roster.ts',p=>p.includes('skinPalette')?palette:p.includes('character')?character:draft);
const prefs=module('prototypes/punchies/src/sim/charPrefs.ts',p=>p.includes('character')?character:{BOT_LEVELS:['easy','normal','hard']});
let state=draft.newShopDraft();
assert.deepEqual(Array.from(roster.availableFighters(state)),ids.slice(0,3));
const welcome=draft.welcomePull(state);assert(welcome.ok);state=welcome.state;assert.equal(welcome.item.boxer,'tee');assert(roster.availableFighters(state).includes('tee'));assert.equal(draft.welcomePull(state).ok,false);
state={...state,owned:[...state.owned,'skin-mia','skin-marco-unique']};draft.saveShopDraft(state);
assert.deepEqual(Array.from(roster.ownedSkins(state,'mia')),['default','skin-mia-violet','skin-mia']);assert.equal(roster.equippedSkin(state,'marco','skin-mia'),'default');assert.equal(roster.equippedSkin(state,'mia','missing'),'default');
prefs.saveCharPrefs({skins:{p1:{mia:'skin-mia'},p2:{mia:'default'}}});assert.equal(prefs.loadCharPrefs().skins.p1.mia,'skin-mia');assert.equal(prefs.loadCharPrefs().skins.p2.mia,'default');
let started=null;
const Scene=module('prototypes/punchies/src/scenes/CharSelectScene.ts',p=>{
 if(p==='phaser')return{default:{Scene:class{}}};
 if(p.includes('shop/roster'))return roster;if(p.includes('shop/draft'))return draft;
 if(p.includes('sim/character'))return character;if(p.includes('charPrefs'))return prefs;
 if(p.includes('render/skins'))return{skinReady:(_s,_c,skin)=>!skin.endsWith('-unique')};
 if(p.includes('sim/tune'))return{tune:JSON.parse(fs.readFileSync('prototypes/punchies/tune.json','utf8'))};
 if(p.includes('ui/presentation'))return{startScreen:(_s,name,data)=>started={name,data}};
 if(p.includes('audio/sfx'))return{sfx:{uiSelect(){},uiConfirm(){},denied(){}}};return{};
}).CharSelectScene;
const s=new Scene();s.data0={mode:'vsai'};s.sides=[{sel:3,src:'any',locked:false},{sel:0,src:'any',locked:false}];
draft.saveShopDraft(draft.newShopDraft());s.confirm(0);assert.equal(s.sides[0].locked,false);assert(!s.sides[0].selected);assert.match(s.notice,/locked/i);
draft.saveShopDraft(state);s.confirm(0);assert(s.sides[0].selected);assert.equal(s.sides[0].locked,false);s.confirm(0);assert(s.sides[0].locked);assert.equal(s.active,1);
s.sides[1].sel=1;s.confirm(1);s.cycleSkin(1,1);s.cycleSkin(1,1);assert.equal(s.sides[1].skin,'skin-mia');s.move(1,1);assert.equal(s.sides[1].sel,1);assert.equal(s.sides[1].skin,'default');s.cycleSkin(1,1);s.cycleSkin(1,1);s.confirm(1);s.fight();assert.equal(started.name,'VsAI');assert.deepEqual(Array.from(started.data.chars),['tee','mia']);assert.deepEqual(Array.from(started.data.skins),['default','skin-mia']);
s.back(1);assert(!s.sides[1].selected);s.move(1,1);assert.equal(s.sides[1].sel,2);
s.data0={mode:'online',localIdx:1};assert.equal(s.prefSide(1),'p1');
console.log('Roster: welcome lock/unlock, one-time claim, per-player skin persistence, ownership isolation, select/skin/ready/back flow, skin handoff, missing unique art exclusion, and guest preference slot passed');

// A peer's locked fighter is independent of the local collection. Invalid or
// unavailable peer picks cannot make the host start; cosmetic IDs match the boxer.
draft.saveShopDraft(draft.newShopDraft());
const packets=[],session={send:m=>packets.push(m)};
const net=new Scene();net.data0={mode:'online',localIdx:0,session};net.time={addEvent:()=>{}};
net.sides=[{sel:0,src:'any',locked:false,skin:'default'},{sel:0,src:'remote',locked:false}];net.setupNet();
session.onCtl({k:'pick',char:'tee',hover:'tee',available:ids.slice(0,3),skin:'skin-mia'});
assert.equal(net.remotePick,null);assert.equal(net.available(1),false);assert.equal(net.sides[1].skin,'default');assert(!net.sides[1].locked);
session.onCtl({k:'pick',char:'tee',hover:'tee',available:ids,skin:'skin-mia'});
assert.equal(net.remotePick,'tee');assert.equal(net.available(1),true);assert.equal(net.available(0),true);
net.confirm(0);net.confirm(0);const start=packets.find(m=>m.k==='start');assert(start);assert.deepEqual(Array.from(start.chars),['marco','tee']);assert.deepEqual(Array.from(start.skins),['default','default']);
console.log('Online roster: independent peer collection, unavailable-pick rejection, hover lock, cosmetic/boxer validation, and ready start payload passed');

draft.saveShopDraft(state);s.data0={mode:'vsai'};s.sides[1].sel=1;assert.equal(s.preferredSkin(1),'skin-mia');s.sides[0].sel=0;assert.equal(s.preferredSkin(0),'default');
console.log("Returning to an owned fighter restores that player's equipped skin");

// Matching starter skins are legal for both players, independent of ownership.
const mirror=new Scene();mirror.data0={mode:'vsai'};mirror.sides=[{sel:0,src:'any',locked:true,skin:'skin-marco-cyan'},{sel:0,src:'any',locked:true,skin:'skin-marco-cyan'}];mirror.fight();assert.deepEqual(Array.from(started.data.chars),['marco','marco']);assert.deepEqual(Array.from(started.data.skins),['skin-marco-cyan','skin-marco-cyan']);
console.log('Matching starter skins are selectable and handed off unchanged');
