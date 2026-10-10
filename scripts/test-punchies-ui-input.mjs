import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { EventEmitter } from 'node:events';
import { i18nStub } from './lib-i18n-stub.mjs';

const keys = new EventEmitter();
let pads = [];
const window = {addEventListener: (k, f) => keys.on(k, f), removeEventListener: (k, f) => keys.off(k, f)};
const navigator = {getGamepads: () => pads};
function load(file, mocks) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText,
    {exports, require: id => mocks[id] ?? {}, window, navigator});
  return exports;
}
const sfx = {uiSelect(){}, uiConfirm(){}, uiBack(){}};
const {MenuNav} = load('prototypes/punchies/src/ui/menuNav.ts', {'../audio/sfx': {sfx}});
class Hit extends EventEmitter {
  constructor(depth, x = 0, y = 0) {super(); Object.assign(this, {depth, x, y, active: true, visible: true, input: {enabled: true}});}
  destroy() {this.active = false; this.emit('destroy');}
  getBounds() {return {x:this.x,y:this.y,width:60,height:30};}
}
function setup(fight = false) {
  const g = {strokes:0,setDepth(){return this;}, clear(){this.strokes=0;}, lineStyle(){}, strokeRect(){this.strokes++;}};
  const scene = {events: new EventEmitter(), input: new EventEmitter(), registry: {get: () => false}, scene: {key:'Training', isActive: () => true}, time: {now:1000}, add: {graphics: () => g}};
  scene.input.enabled = true;
  const nav = new MenuNav(scene); nav.fightMode = fight;
  return {scene, nav, g, key: (key, repeat = false) => keys.emit('keydown', {key, repeat}), tick: () => scene.events.emit('update'), stop: () => scene.events.emit('shutdown')};
}
const pad = () => ({buttons: Array.from({length:16}, () => ({pressed:false})), axes:[0,0]});

// Shop ad suppression covers global keys and pads, including Back and held edges.
{
  const h=setup(), calls=[], anchor=new Hit(300), button=new Hit(302);
  h.scene.scene.key='Shop';
  h.nav.add(button,()=>calls.push('buy'));h.nav.modalBack(anchor,()=>calls.push('close'));
  h.key('ArrowDown');h.tick();assert.equal(h.g.strokes,1);
  h.scene.input.enabled=false;
  h.key('Enter');h.key('Escape');h.key('ArrowDown');assert.equal(h.g.strokes,0);
  pads=[pad()];for(const n of [0,1,9,13])pads[0].buttons[n].pressed=true;
  h.tick();h.tick();assert.deepEqual(calls,[]);assert.equal(h.g.strokes,0);
  h.scene.input.enabled=true;h.tick();h.tick();assert.deepEqual(calls,[],'held ad input must not fire upon resume');
  pads[0].buttons.forEach(b=>b.pressed=false);h.tick();
  h.key('ArrowDown');pads[0].buttons[0].pressed=true;h.tick();assert.deepEqual(calls,['buy']);
  // During reveal, only its acknowledgement becomes reachable; underlying Shop hits stay disabled.
  button.input.enabled=false;anchor.destroy();h.key('ArrowDown');h.key('Enter');assert.deepEqual(calls,['buy']);
  const ack=new Hit(610);h.nav.add(ack,()=>calls.push('ack'));h.key('ArrowDown');h.key('Enter');assert.deepEqual(calls,['buy','ack']);
  h.stop();pads=[];
}
// Source overlay suppression consumes held pad input without taking Hook ownership.
{
  const h=setup(true), calls=[];h.nav.engage();h.nav.add(new Hit(130),()=>calls.push('source'));
  h.key('ArrowDown');h.scene.registry.get=()=>true;
  pads=[pad()];pads[0].buttons[0].pressed=true;h.tick();assert.equal(h.g.strokes,0);
  h.scene.registry.get=()=>false;h.tick();assert.deepEqual(calls,[]);
  h.stop();pads=[];
}

// Always-visible pause chrome must not own results or practice controls.
for (const depth of [130,150,291]) {
  const h = setup(true), calls = [];
  h.nav.add(new Hit(220), () => calls.push('pause'));
  h.nav.add(new Hit(depth,0,40), () => calls.push('first'));
  h.nav.add(new Hit(depth,0,90), () => calls.push('second'));
  if (depth === 130) {assert.equal(h.nav.capturing,false); h.nav.engage();}
  else assert.equal(h.nav.capturing,true);
  h.key('ArrowDown'); h.key('ArrowDown'); h.key('Enter');
  assert.deepEqual(calls,['second']); h.stop();
}

// Topmost cancel only, held input, underlying focus restoration and no input leak.
{
  const h=setup(), calls=[];
  const first=new Hit(130,0,0), second=new Hit(130,0,40);
  h.nav.add(first,()=>calls.push('first')); h.nav.add(second,()=>calls.push('second'));
  h.key('ArrowDown');h.key('ArrowDown');
  const outer=new Hit(410), outerButton=new Hit(412);
  h.nav.add(outerButton,()=>calls.push('outer activation'));
  h.nav.modalBack(outer,()=>{calls.push('outer close');outer.destroy();outerButton.destroy();});
  h.key('ArrowDown');
  const inner=new Hit(450), innerButton=new Hit(452);
  h.nav.add(innerButton,()=>calls.push('inner activation'));
  h.nav.modalBack(inner,()=>{calls.push('inner close');inner.destroy();innerButton.destroy();});
  h.key('Escape');h.key('Escape',true);
  assert.deepEqual(calls,['inner close']); assert.equal(outer.active,true);
  pads=[pad()];pads[0].buttons[1].pressed=true;pads[0].buttons[0].pressed=true;h.tick();h.tick();
  assert.deepEqual(calls,['inner close','outer close'],'B closes once and simultaneous A cannot activate underneath');
  pads[0].buttons[1].pressed=false;pads[0].buttons[0].pressed=false;h.tick();
  h.key('Enter');assert.equal(calls.at(-1),'second','previous focus restored');
  h.stop();pads=[];
}
{
  const h=setup(), outer=new Hit(410), inner=new Hit(450), calls=[];
  const outerButton=new Hit(412), innerButton=new Hit(452);
  h.nav.add(outerButton,()=>{});h.nav.add(innerButton,()=>{});
  h.nav.modalBack(outer,()=>{calls.push('outer');outer.destroy();outerButton.destroy();});
  h.nav.modalBack(inner,()=>{calls.push('inner');inner.destroy();innerButton.destroy();});
  pads=[pad(),pad()];pads.forEach(p=>p.buttons[1].pressed=true);h.tick();h.tick();
  assert.deepEqual(calls,['inner'],'simultaneous controller Back closes one panel');
  h.stop();pads=[];
}
{
  const h=setup(), anchor=new Hit(410), deeper=new Hit(452);let closed=0;
  h.nav.modalBack(anchor,()=>closed++);h.nav.add(deeper,()=>{});h.key('Escape');assert.equal(closed,0,'unowned deeper modal shields underlying Back');
  deeper.destroy();h.nav.textEntry=true;h.key('Escape');assert.equal(closed,0,'room entry owns keyboard Escape');
  pads=[pad()];pads[0].buttons[1].pressed=true;h.tick();assert.equal(closed,1,'controller B still closes room entry');
  h.stop();pads=[];
}
{
  const h=setup(true);h.nav.add(new Hit(220),()=>assert.fail('pause activated'));
  pads=[pad()];pads[0].buttons[1].pressed=true;h.tick();assert.equal(h.nav.capturing,false,'B remains combat Hook');
  h.nav.engage();pads[0].buttons[1].pressed=false;h.tick();pads[0].buttons[1].pressed=true;h.tick();
  assert.equal(h.nav.capturing,true,'B must not toggle practice navigation without a modal');
  const anchor=new Hit(410),button=new Hit(412);let closed=0;
  h.nav.add(button,()=>{});h.nav.modalBack(anchor,()=>closed++);h.tick();assert.equal(closed,0,'held gameplay B is not a modal edge');
  pads[0].buttons[1].pressed=false;h.tick();pads[0].buttons[1].pressed=true;h.tick();assert.equal(closed,1);
  h.stop();pads=[];
}

// Exercise the scene's actual format handlers and device ownership.
const tune={match:{bestOf:3}};
const {CharSelectScene}=load('prototypes/punchies/src/scenes/CharSelectScene.ts', {
  phaser:{default:{Scene:class{}}}, '../sim/tune':{tune}, '../audio/sfx':{sfx}, '../i18n':i18nStub,
});
for (const mode of ['vsai','localvs','online','training']) {
  const s=new CharSelectScene();s.active=0;s.time={now:1000};
  s.sides=[{src:'kb1'},{src:'pad2'}];s.data0={mode,localIdx:0};tune.match.bestOf=3;
  s.onKey({code:'KeyF'});assert.equal(tune.match.bestOf,mode==='training'?3:1);
  s.onKey({code:'KeyF',repeat:true});assert.equal(tune.match.bestOf,mode==='training'?3:1);
  s.sides=[{src:'pad1'},{src:'pad2'}];
  pads=[pad()];pads[0].buttons[3].pressed=true;s.pollPads();s.pollPads();
  assert.equal(tune.match.bestOf,3,'Y changes once per press');
  if(mode==='online') {s.data0.localIdx=1;s.onKey({code:'KeyF'});s.cycleFormat();assert.equal(tune.match.bestOf,3,'guest cannot change host format');}
  if(mode==='localvs') {
    s.sides=[{src:'touch'},{src:'kb2'}];
    pads[0].buttons[3].pressed=false;s.pollPads();pads[0].buttons[3].pressed=true;s.pollPads();
    assert.equal(tune.match.bestOf,3,'unassigned pad cannot change local format');
    s.onKey({code:'KeyF'});assert.equal(tune.match.bestOf,1,'shared format shortcut works with either keyboard half assigned');
  }
}
assert.match(i18nStub.t('charselect.format_hint'),/F.*Y/);

// Exercise the real room keypad with shared feedback: no filled hit rectangles,
// release inside only, navigation once, physical typing once, and teardown.
{
  const {bindButtonFeedback}=load('prototypes/punchies/src/ui/cartoonChrome.ts', {});
  const h=setup(), objects=[], registered=[], transitions=[];
  h.scene.events.setMaxListeners(0); // One feedback update listener per keypad key, as in Phaser.
  class Obj extends Hit {
    constructor(x,y,label=''){super(0,x,y);this.text=label;this.data={};this.scene=h.scene;objects.push(this);}
    setDepth(d){this.depth=d;return this;}setOrigin(){return this;}setInteractive(){return this;}setStrokeStyle(){return this;}
    setText(s){this.text=s;return this;}setData(k,v){this.data[k]=v;return this;}getData(k){return this.data[k];}
    setFillStyle(){assert.fail('transparent keypad hit must never be filled');}
  }
  const {MenuScene}=load('prototypes/punchies/src/scenes/MenuScene.ts', {
    phaser:{default:{Scene:class{}}}, '../i18n':i18nStub,
    '../render/pixelRatio':{VIEW:{cx:422,cy:195,width:844,height:390},PIXEL_RATIO:1},
    '../net/roomCode':{ROOM_ALPHABET:'23456789ABCDEFGHJKMNPQRSTUVWXYZ',normalizeRoomCode:s=>s.length===3?s:null},
    '../ui/cartoonChrome':{bindButtonFeedback,cartoonPanel(){},cartoonButton(_g,_x,y){transitions.push(y);}},
    '../ui/menuNav':{getNav:()=>h.nav,navRegister:(_s,bg,fn)=>{registered.push({bg,fn});h.nav.add(bg,fn);}},
    '../ui/presentation':{startScreen:(_s,key,data)=>transitions.push({key,data})},
  });
  const menu=new MenuScene();menu.events=h.scene.events;menu.input=h.scene.input;
  menu.add={rectangle:(x,y)=>new Obj(x,y),text:(x,y,s)=>new Obj(x,y,s),graphics:()=>{
    const g=new Obj(0,0);g.clear=()=>g;g.fillStyle=()=>g;g.fillRoundedRect=()=>g;return g;
  }};
  menu.join();assert.equal(h.nav.textEntry,true);
  const first=registered[0].bg,slots=objects.filter(o=>o.y===103&&o.depth===302);
  first.emit('pointerdown');assert.equal(slots[0].text,'');assert.equal(transitions.at(-1),158,'rounded chrome moves down when pressed');
  first.emit('pointerup');assert.equal(transitions.at(-1),156,'rounded chrome restores idle position');assert.equal(slots[0].text,'2');assert.equal(slots[1].text,'');
  first.emit('pointerdown');first.emit('pointerout');first.emit('pointerup');assert.equal(slots[1].text,'');
  first.emit('pointerdown');first.emit('pointerupoutside');first.emit('pointerup');assert.equal(slots[1].text,'');
  h.key('ArrowDown');pads=[pad()];pads[0].buttons[0].pressed=true;h.tick();assert.equal(slots[1].text,'2');assert.equal(slots[2].text,'');
  h.key('A');assert.equal(slots[2].text,'A');h.key('Backspace');assert.equal(slots[2].text,'');
  menu.input.enabled=false;h.key('B');assert.equal(slots[2].text,'');menu.input.enabled=true;
  h.key('B');h.key('Enter');assert.deepEqual(JSON.parse(JSON.stringify(transitions.at(-1))),{key:'Lobby',data:{role:'guest',code:'22B'}});
  assert.equal(h.nav.textEntry,false);assert.ok(objects.every(o=>!o.active));
  assert.equal(h.scene.events.listenerCount('update'),1,'keypad feedback update listeners removed');
  menu.join();assert.equal(h.nav.textEntry,true);h.stop();pads=[];
  assert.equal(h.nav.textEntry,false);assert.ok(objects.every(o=>!o.active));
  assert.equal(h.scene.events.listenerCount('update'),0);assert.equal(keys.listenerCount('keydown'),0);
}
console.log('UI input: ad/overlay suppression, held controller edges, reveal ownership, rounded keypad release/typing/cleanup, pause exclusion, results/practice navigation, modal priority, focus restoration, gameplay Hook and format ownership passed');

// Preserve the existing timeout and its cancellation; diagnostics follow debug mode.
const netTune=JSON.parse(fs.readFileSync('prototypes/punchies/tune.json','utf8'));
let debug=false, session, timer, returned;
class NetSession {constructor(){session=this;} leave(){this.left=true;}}
const {LobbyScene}=load('prototypes/punchies/src/scenes/LobbyScene.ts', {
  phaser:{default:{Scene:class{}}}, '../i18n':i18nStub, '../sim/tune':{tune:netTune},
  '../net/session':{NetSession,relayStatus:()=>({open:1,total:3})},
  '../net/turn':{fetchTurnIceServers:async()=>undefined},
  '../ui/presentation':{startScreen:(_s,key,data)=>returned={key,data}},
  '../portal/analytics':{track(){}}, '../debug/debugPanel':{isDebug:()=>debug},
  '../render/pixelRatio':{VIEW:{cx:422,cy:195},PIXEL_RATIO:1},
});
const lobby=new LobbyScene();
const label={setOrigin(){return this;},setText(text){this.text=text;return this;},setVisible(visible){this.visible=visible;return this;}};
lobby.add={text:()=>label};lobby.status=label;lobby.diag=label;lobby.scene={isActive:()=>true};
lobby.time={now:25000,delayedCall:(delay,callback)=>timer={delay,callback}};
lobby.startedAt=0;await lobby.join('ABC');
assert.equal(timer.delay,netTune.net.connectTimeoutMs);
timer.callback();assert.equal(returned.key,'Menu');assert.match(returned.data.message,/ABC/);
returned=null;session.peerId='peer';timer.callback();assert.equal(returned,null,'paired guest must not time out');
lobby.updateDiag();assert.equal(label.visible,false);debug=true;lobby.updateDiag();assert.equal(label.visible,true);assert.match(label.text,/relays 1\/3/);
console.log('Lobby: configured existing guest timeout, paired-peer protection and debug-only diagnostics passed');
