import assert from 'node:assert/strict';
import { i18nStub } from './lib-i18n-stub.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const cfg=JSON.parse(fs.readFileSync('prototypes/punchies/tune.json','utf8')).view.menu.rewardReveal;
class Obj {
 constructor(kind,args){this.kind=kind;this.args=args;this.list=[];this.width=240;this.alpha=1;this.handlers={};}
 add(o){this.list.push(o);return this;}setColor(v){this.color=v;return this;}setTint(){return this;}once(k,fn){this.handlers[k]=fn;return this;}setDepth(v){this.depth=v;return this;}setInteractive(){this.interactive=true;return this;}setAlpha(v){this.alpha=v;return this;}setScale(v){this.scale=v;return this;}setOrigin(){return this;}setDisplaySize(){return this;}on(k,fn){this.handlers[k]=fn;return this;}destroy(){this.handlers.destroy?.();this.destroyed=true;for(const o of this.list)o.destroy();}
}
function run(reduced=false){
 const objects=[],timers=[],tweens=[],nav=[],accents=[];let closed=0;
 const make=kind=>(...args)=>{const o=new Obj(kind,args);objects.push(o);return o;};
 const scene={add:{container:make('container'),rectangle:make('rectangle'),text:make('text'),image:make('image'),graphics:make('graphics')},
 textures:{exists:()=>false},time:{delayedCall:(delay,fn)=>{const t={delay,fn,remove(){this.removed=true;}};timers.push(t);return t;}},tweens:{addCounter:()=>({remove(){}}),add:t=>tweens.push(t),killTweensOf:()=>{}},events:{once(){},off(){}}};
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/ui/rewardReveal.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:function mockedRequire(p){
 if(p.includes('portal/analytics'))return{track(){}};
 if(p.includes('i18n'))return i18nStub;
 if(p.includes('itemText'))return{itemName:i=>i.name};
 if(p==='phaser')return{default:{GameObjects:{Container:Obj},Display:{Color:{HSVToRGB:()=>({color:0xffffff})}}}};
 if(p.includes('rewardAccents'))return{PullAccents:class {
  constructor(owner,parent,x,y,legendary,chestKey){Object.assign(this,{owner,parent,x,y,legendary,chestKey,foreground:false,destroyed:false});accents.push(this);}
  bringHighlightForward(parent){assert.equal(parent,this.parent);this.foreground=true;}
  destroy(){this.destroyed=true;}
 }};
 if(p.includes('rewardRarity')){const e={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/ui/rewardRarity.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:e,require:mockedRequire});return e;}
 if(p.includes('render/art'))return{artKey:()=>null};
 if(p.includes('pixelRatio'))return{PIXEL_RATIO:1,VIEW:{cx:422,cy:195,width:844,height:390,bottom:390}};
 if(p.includes('sim/tune'))return{tune:{view:{menu:{rewardReveal:cfg,shopRayRotationMs:18000}}}};
 if(p.includes('presentation'))return{reducedMotion:()=>reduced};
 if(p.includes('audio/stingers'))return{playStinger(){return()=>{};}};
 if(p.includes('cartoonChrome'))return{cartoonPanel(){},cartoonButton(){},bindButtonFeedback(){}};
 if(p.includes('menuNav'))return{navRegister:(_s,bg,fn)=>nav.push({bg,fn})};return{};
 }});
 const reveal=new exports.RewardReveal(scene,{name:'G.P. TEE',kind:'fighters',boxer:null},()=>closed++);
 assert.equal(accents.length,1);assert.equal(accents[0].owner,scene);assert.equal(accents[0].parent,objects[0]);assert.equal(accents[0].foreground,true);assert.equal(accents[0].legendary,true);assert.equal(accents[0].chestKey,null);
 assert.equal(nav.length,0,'no acknowledgement before hold');assert.equal(objects[1].interactive,true);assert.equal(objects[1].args[5],1,'shade has opaque fill for alpha animation');assert.equal(objects[1].alpha,0);assert.equal(tweens[0].alpha,cfg.darkenAlpha);
 assert.equal(timers[0].delay,cfg.entryMs+cfg.portraitHoldMs);assert.equal(timers[1].delay,timers[0].delay+cfg.ackDelayMs);
 timers[0].fn();assert(objects.some(o=>o.kind==='text'&&o.args[2]==='G.P. TEE'));assert.equal(nav.length,0);
 timers[1].fn();assert.equal(nav.length,1);nav[0].fn();nav[0].fn();assert.equal(closed,1);assert(timers.every(t=>t.removed));assert(objects[0].destroyed);assert(accents[0].destroyed,'acknowledgement disposes accents');
 if(reduced)assert(tweens.every(t=>t.duration===0));
 const interrupted=new exports.RewardReveal(scene,{name:'SKIN',kind:'skins',boxer:null},()=>closed++);interrupted.destroy();timers.at(-2).fn();timers.at(-1).fn();assert.equal(nav.length,1,'shutdown cannot resurrect acknowledgement');assert(accents[1].destroyed,'interrupted scene disposes accents');
}
run();run(true);
console.log('Reward reveal: input shield, portrait hold/name/button order, reduced motion, one-time acknowledgement, timer cleanup and interrupted scene passed');
