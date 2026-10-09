import assert from 'node:assert/strict';
import { i18nStub } from './lib-i18n-stub.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const store=new Map();
const storage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)};
const ids=['marco','mia','bruno','tee','tyke','dragon','longan'];
const character={CHARACTER_IDS:ids,isCharId:id=>ids.includes(id)};
const portalStore={store:{getItem:k=>storage.getItem(k)??null,setItem:(k,v)=>storage.setItem(k,v),removeItem:k=>storage.removeItem?.(k)}};
const portalKeys={KEYS:{audio:'punchies:audio:v1',shop:'punchies:shop-preview:v1',tutorial:'punchies:tutorial:v1',chars:'punchies:chars:v1',localInputs:'punchies:localInputs:v1'}};
function module(file,rawRequire) {
 const require=id=>id.includes('/i18n')?i18nStub:id.includes('itemText')?{itemName:i=>i.name}:id.includes('portal/store')?portalStore:id.includes('portal/keys')?portalKeys:id.includes('portal/gameplay')?{setGameplay(){},trackFightScene(){}}:id.includes('portal/index')?{loadingFinished(){},showRewardedAd:async()=>'rewarded',portal:{ads:{available:true,kind:'preview'}}}:rawRequire(id);
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require,localStorage:storage,Date,Math,Set,Number,JSON,Object,Array});return exports;
}
const palette=module('prototypes/punchies/src/render/skinPalette.ts',()=>({}));
const draft=module('prototypes/punchies/src/shop/draft.ts',p=>p.includes('skinPalette')?palette:({default:JSON.parse(fs.readFileSync('prototypes/punchies/src/shop/draft-config.json','utf8'))}));
const roster=module('prototypes/punchies/src/shop/roster.ts',p=>p.includes('skinPalette')?palette:p.includes('character')?character:draft);
const prefs=module('prototypes/punchies/src/sim/charPrefs.ts',p=>p.includes('character')?character:{BOT_LEVELS:['easy','normal','hard']});
let state=draft.newShopDraft();
assert.deepEqual(Array.from(roster.availableFighters(state)),ids.slice(0,3));
assert(!roster.availableFighters(state).includes('tee'),'Tee is locked until pulled');state={...state,owned:[...state.owned,draft.WELCOME_FIGHTER]};assert(roster.availableFighters(state).includes('tee'));
state={...state,owned:[...state.owned,'skin-mia','skin-marco-unique']};draft.saveShopDraft(state);
assert.deepEqual(Array.from(roster.ownedSkins(state,'mia')),['default','skin-mia']);assert.equal(roster.equippedSkin(state,'marco','skin-mia'),'default');assert.equal(roster.equippedSkin(state,'mia','missing'),'default');
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
s.sides[1].sel=1;s.confirm(1);s.cycleSkin(1,1);assert.equal(s.sides[1].skin,'skin-mia');s.move(1,1);assert.equal(s.sides[1].sel,1);assert.equal(s.sides[1].skin,'default');s.cycleSkin(1,1);s.confirm(1);s.fight();assert.equal(started.name,'VsAI');assert.deepEqual(Array.from(started.data.chars),['tee','mia']);assert.deepEqual(Array.from(started.data.skins),['default','skin-mia']);
s.back(1);assert(!s.sides[1].selected);s.move(1,1);assert.equal(s.sides[1].sel,2);
s.data0={mode:'online',localIdx:1};assert.equal(s.prefSide(1),'p1');
console.log('Roster: Tee lock/unlock, per-player skin persistence, ownership isolation, select/skin/ready/back flow, skin handoff, missing unique art exclusion, and guest preference slot passed');

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

// Matching skins are legal for both players after acquisition.
draft.saveShopDraft({...state,owned:[...state.owned,"skin-marco-cyan"]});
const mirror=new Scene();mirror.data0={mode:'vsai'};mirror.sides=[{sel:0,src:'any',locked:true,skin:'skin-marco-cyan'},{sel:0,src:'any',locked:true,skin:'skin-marco-cyan'}];mirror.fight();assert.deepEqual(Array.from(started.data.chars),['marco','marco']);assert.deepEqual(Array.from(started.data.skins),['skin-marco-cyan','skin-marco-cyan']);
console.log('Matching starter skins are selectable and handed off unchanged');

// Training owns only the player pick. The fixed dummy cannot be changed by
// roster movement, skin input, tapping its panel or confirmation.
const training=new Scene();training.data0={mode:'training'};
training.sides=[{sel:0,src:'any',locked:false,skin:'skin-marco-cyan'},
 {sel:0,src:'remote',locked:true,skin:'default'}];
const dummyBefore=JSON.stringify(training.sides[1]);
training.move(1,1);training.cycleSkin(1,1);training.tapPanel(1);training.confirm(1);
assert.equal(JSON.stringify(training.sides[1]),dummyBefore);
assert.equal(training.active,0);
training.confirm(0);training.confirm(0);training.fightButton();
assert.equal(started.name,'Training');assert.equal(started.data.char,'marco');
assert.equal(started.data.skin,'skin-marco-cyan');
assert.equal(prefs.loadCharPrefs().p1,'marco');
assert.equal(prefs.loadCharPrefs().skins.p1.marco,'skin-marco-cyan');
training.back(0);assert.equal(training.sides[0].locked,false);
assert.equal(training.sides[1].locked,true);
console.log('Training: fixed dummy ignores opponent input; selected owned boxer/skin handed off and persisted');

const fresh=draft.newShopDraft();
for(const id of palette.STARTER_SKINS){assert(draft.availablePool(fresh,"skins").some(i=>i.id===id));assert(!roster.ownedSkins(fresh,id.split("-")[1]).includes(id));}
for(const id of ["tyke","dragon","longan"]){assert(!roster.availableFighters(fresh).includes(id));const item=draft.SHOP_ITEMS.find(i=>i.kind==="fighters"&&i.boxer===id);assert(item);assert(roster.availableFighters({...fresh,owned:[item.id]}).includes(id));}
assert(draft.availablePool(fresh,"skins").some(i=>i.id==="skin-mia-flaming-kunoichi"&&i.skinType==="unique"));
console.log("New fighters and alternate skins locked until acquired; unique Kunoichi reward in pool passed");

const classic=draft.SHOP_ITEMS.find(i=>i.id==='skin-marco-mcclassic');
assert.equal(classic.skinType,'unique');assert.equal(classic.rigGroup,'marco_mcclassic');
assert(!roster.ownedSkins(fresh,'marco').includes(classic.id));
assert(roster.ownedSkins({...fresh,owned:[classic.id]},'marco').includes(classic.id));
const tune=JSON.parse(fs.readFileSync('prototypes/punchies/tune.json','utf8'));
assert.deepEqual(tune.characters.longan,tune.characters.marco);
console.log('Outsource content: Longan acquisition, McClassic ownership and provisional baseline stats passed');
