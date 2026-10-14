import assert from 'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import {EventEmitter} from 'node:events';
function load(file,mocks={},globals={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/'+file+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,structuredClone,...globals,require:key=>mocks[key]??{}});return exports;}
const mode=load('ui/controlMode');
const raw=new Map(),key='localInputs';const store={getItem:k=>raw.get(k)??null,setItem:(k,v)=>raw.set(k,v)};
const prefs=load('input/controlPreferences',{'../portal/store':{store},'../portal/keys':{KEYS:{localInputs:key}},'../ui/controlMode':mode});
assert.equal(prefs.loadControlModes().join(','),'modern,modern');
raw.set(key,JSON.stringify({p1:'pad1',layouts:{custom:true},controlModes:{p1:'classic',p2:'bad'}}));
assert.equal(prefs.loadControlModes().join(','),'classic,modern');prefs.saveControlMode(1,'classic');
assert.deepEqual(JSON.parse(raw.get(key)),{p1:'pad1',layouts:{custom:true},controlModes:{p1:'classic',p2:'classic'}});
for(const broken of ['{','null','[]','false']){raw.set(key,broken);assert.equal(prefs.loadControlModes().join(','),'modern,modern');prefs.saveControlMode(0,'classic');assert.equal(prefs.loadControlModes()[0],'classic');}
const local=load('input/localSetup',{'../portal/store':{store},'../portal/keys':{KEYS:{localInputs:key}},'./layouts':{loadLayouts:()=>({retained:true})}});
local.saveLocalInputs({p1:'kb1',p2:'kb2'});assert.equal(prefs.loadControlModes()[0],'classic','device changes preserve mode');
raw.set(key,'{');local.saveLocalInputs({p1:'kb1',p2:'kb2'});assert.equal(JSON.parse(raw.get(key)).p1,'kb1','malformed save remains repairable');
for(const width of [844,1024,1200]){const v={left:0,top:0,width,height:390},layout=mode.modernControlLayout(v,{x:width*.9,y:300},{x:width*.95,y:184});assert(layout.normal.x+layout.normal.r<=width-9);assert(layout.superButton.y+layout.superButton.r<layout.normal.y-layout.normal.r);assert((2*layout.normal.r)*640/width>=60,'mobile primary hit area');}
const win=new EventEmitter(),g=()=>new Proxy(new EventEmitter(),{get(o,p){if(p in o)return typeof o[p]==='function'?o[p].bind(o):o[p];if(p==='width')return 80;return()=>gObj;}});let gObj;
gObj=g();const add={graphics:()=>g(),text:()=>g()};
const view={left:0,top:0,width:844,height:390,cx:422,cy:195};const resolved={main:{x:752,y:300,r:58},uppercut:{x:794,y:184,r:32},hook:{x:652,y:318,r:28},guard:{x:668,y:236,r:28},dodge:{x:722,y:190,r:26},stick:{x:110,y:300,r:48}};
const held=new Set(),taps=[];const intents={clearAll(){held.clear();},tap(k){taps.push(k);},setGuard(){},setTouchMove(){}};
const input=new EventEmitter();input.addPointer=()=>{};
const scene={add,input,events:new EventEmitter(),cameras:{main:{getWorldPoint:(x,y)=>({x,y})}}};
const touch=load('ui/TouchControls',{'./controlMode':mode,'../i18n':{t:k=>k},'../render/pixelRatio':{VIEW:view,PIXEL_RATIO:1},'../render/art':{artImage:()=>null},'../input/layouts':{safeTouch:v=>v,loadLayouts:()=>({touch:{}}),resolveTouch:()=>resolved,hitTouch:()=>null},'../sim/tune':{tune:{input:{joystickRadius:48}}}},{window:{addEventListener:(k,f)=>win.on(k,f),removeEventListener:(k,f)=>win.off(k,f)}});
const c=new touch.TouchControls(scene,intents);assert.throws(()=>c.setMode('modern'),/sink/);
c.setMode('modern',(source,on)=>on?held.add(source):held.delete(source));
c.onDown({id:1,x:752,y:300});assert.equal(held.size,1);c.onDown({id:2,x:752,y:300});assert.equal(held.size,2);
c.onUp({id:1});assert.equal(held.size,1);c.enabled=false;assert.equal(held.size,0,'modal disable releases all held sources');
c.enabled=true;c.onDown({id:3,x:752,y:300});win.emit('pointercancel');assert.equal(held.size,0);
c.onDown({id:4,x:752,y:300});c.setVisible(false);assert.equal(held.size,0,'hiding controls releases held attack');c.onDown({id:5,x:752,y:300});assert.equal(held.size,0);
c.setVisible(true);c.onDown({id:6,x:794,y:184});assert.deepEqual(taps,['uppercut']);
c.onDown({id:7,x:752,y:300});scene.events.emit('shutdown');assert.equal(held.size,0);assert.equal(input.listenerCount('pointerdown'),0);assert.equal(win.listenerCount('pointercancel'),0);
console.log('PASS Modern preferences/migration/device preservation, responsive hit areas, required sink, multi-pointer hold/release, hide/disable/cancel/shutdown cleanup, Super tap');
