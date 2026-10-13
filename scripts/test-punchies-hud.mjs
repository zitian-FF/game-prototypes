import assert from 'node:assert/strict';
import { i18nStub } from './lib-i18n-stub.mjs';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
const cache=new Map();let reduced=false;
const VIEW={left:0,right:844,top:0,bottom:390,width:844,height:390,cx:422,cy:195};
const phaser={Math:{Clamp:(v,a,b)=>Math.max(a,Math.min(b,v))}};
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);if(file.endsWith('.json'))return {default:JSON.parse(fs.readFileSync(file,'utf8'))};const exports={};cache.set(file,exports);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext(code,{exports,structuredClone,console,require:id=>id.endsWith('/i18n')?i18nStub:id==='phaser'?{default:phaser}:id.endsWith('pixelRatio')?{VIEW,PIXEL_RATIO:1}:id.endsWith('superMeterLightning')?{SuperMeterLightning:class {constructor(scene,bounds){this.scene=scene;this.bounds=bounds;(scene.lightning??=[]).push(this);}setBounds(b){this.bounds=b;}setReady(r){this.ready=r;}}}:id.endsWith('presentation')?{reducedMotion:()=>reduced}:load(path.resolve(path.dirname(file),id.endsWith('.json')?id:id+'.ts'))});return exports;}
const {Hud}=load('prototypes/punchies/src/ui/Hud.ts');
const {createSimState}=load('prototypes/punchies/src/sim/sim.ts');
const {tune}=load('prototypes/punchies/src/sim/tune.ts');
function fixture(){const texts=[],polygons=[],fills=[];let currentColor=0;const graphics=new Proxy({}, {get:(_,method)=>(...args)=>{if(method==='fillStyle'){currentColor=args[0];fills.push(args);}if(method==='fillPoints'){for(const p of args[0])assert(Number.isFinite(p.x)&&Number.isFinite(p.y));polygons.push({color:currentColor,points:args[0]});}return graphics;}});const scene={time:{now:0},add:{graphics:()=>graphics,text:(x,y,text,style)=>{const t={x,y,text,style,width:text.length*8,visible:true,alpha:1,scale:1,scaleX:1};for(const m of ['setOrigin','setDepth','setPosition','setStroke','setFontFamily','setColor','setShadow'])t[m]=()=>t;t.setVisible=v=>(t.visible=v,t);t.setScale=v=>(t.scale=v,t.scaleX=v,t);t.setAlpha=v=>(t.alpha=v,t);t.setText=v=>(t.text=v,t.width=v.length*8,t);t.setFontSize=v=>(t.style.fontSize=v,t);texts.push(t);return t;}}};return {scene,texts,polygons,fills};}
for(const width of [844,1200]){VIEW.width=width;VIEW.right=width;const f=fixture(),hud=new Hud(f.scene,['A VERY LONG ONLINE NAME','OTHER']);hud.resourceRow=[0,1];const s=createSimState({timed:true,fighters:[{char:'marco'},{char:'mia'}]});s.fighters[0].stars=2;s.fighters[1].stars=3;s.fighters[0].stamina=0;s.fighters[1].exhausted=true;
hud.setSeries({bestOf:3,roundNumber:3,wins:[1,1]});hud.draw(s);const upper=f.texts.filter(t=>t.text===i18nStub.t('common.super'));assert.equal(upper[0].visible,false);assert.equal(upper[1].visible,true);assert.equal(f.scene.lightning[1].ready,true);const name=f.texts.find(t=>t.text==='A VERY LONG ONLINE NAME');assert(name.scale*name.width<=VIEW.width*.18);
s.fighters[1].stars=0;hud.draw(s);assert.equal(upper[1].visible,false,'spending a charge immediately hides SUPER');assert.equal(f.scene.lightning[1].ready,false);
hud.shown=new Set(['health']);hud.draw(s);assert.equal(upper[0].visible,false);assert.equal(upper[1].visible,false);assert(f.texts.filter(t=>['HP','STM','STUN'].includes(t.text)).every(t=>t.visible===(t.text==='HP')));
hud.shown=null;hud.rejectStamina(0);hud.draw(s);assert(f.polygons.some(p=>p.color===0xff3b30),'rejected zero-stamina action flashes the empty meter');
s.fighters[1].stars=3;reduced=true;f.scene.time.now=1000;hud.draw(s);const a=upper[1].alpha,scale=upper[1].scale;f.scene.time.now=1200;hud.draw(s);assert.equal(upper[1].alpha,a);assert.equal(upper[1].scale,scale);reduced=false;
assert(f.fills.some(v=>v[0]===0xef3545),'emergency fill uses red');}
console.log('HUD: tutorial reveals, zero-meter rejection, emergency red fill, upper charge/spend, long names, wide layouts, reduced-motion steady readiness passed');



// Boss HUD remains separate from the nearest zombie's normal fighter stats.
for(const width of [640,844,1200]){
 VIEW.width=width;VIEW.cx=width/2;VIEW.right=width;
 const f=fixture(),hud=new Hud(f.scene,['MARCO','ZOMBIE']);hud.sidesShown=[true,false];hud.showRoundSockets=false;
 const s=createSimState({timed:false,fighters:[{char:'marco'},{char:'mia'}]});
 const healthBar=()=>f.polygons.filter(p=>p.color===0xef4db6&&p.points.some(v=>v.x>VIEW.cx));
 hud.timerText='00';hud.survivalBoss={key:'run:3',name:'A VERY LONG LOCALIZED BOSS NAME',health:156,maxHealth:220};hud.draw(s);
 assert(f.texts.some(o=>o.text==='BOSS'&&o.visible),'boss phase replaces expired countdown');
 const name=f.texts.find(o=>o.text.startsWith('BOSS · ')),hp=f.texts.find(o=>o.text==='156 / 220 HP');assert(name&&hp&&name.visible&&hp.visible);
 assert(name.x+name.width*name.scaleX+12<=hp.x-hp.width*hp.scaleX+1e-6,'boss label and HP never overlap');
 assert(healthBar().length>0,'right pink boss HP wing');
 hud.survivalBoss={key:'run:6',name:'BRUNO',health:null,maxHealth:null};f.polygons.length=0;hud.draw(s);
 assert(f.texts.some(o=>o.text==='Incoming…'&&o.visible));assert(!f.texts.some(o=>o.visible&&o.text==='0 / 0 HP'));assert.equal(healthBar().length,0,'incoming boss gets no invented health bar');
 hud.survivalBoss={key:'run:6',name:'BRUNO',health:0,maxHealth:null};hud.draw(s);assert(!f.texts.some(o=>o.visible&&o.text==='Incoming…'),'defeated boss is not incoming');
 hud.survivalBoss=null;hud.timerText='29';hud.draw(s);assert(f.texts.some(o=>o.text==='29'&&o.visible&&o.style.fontSize===29),'normal timer font restored');assert.equal(name.visible,false);assert.equal(hp.visible,false);
}
console.log('Boss HUD: actual HP wing, incoming no fake HP, defeated state, clock restore and nonoverlapping labels at 640/844/1200 passed');
