import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import EventEmitter from 'eventemitter3';
let reduced=false,bakes=0;const textures=new Map(),exp={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/render/combatSymbols.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exp,Math,require:()=>({reducedMotion:()=>reduced})});
function scene(){const objects=[],events=new EventEmitter();const image=(_x,_y,_atlas,frame)=>{const o={frame,parentContainer:{},destroyed:false};o.setDepth=d=>(o.depth=d,o);o.setVisible=v=>(o.visible=v,o);o.setPosition=(x,y)=>(o.x=x,o.y=y,o);o.setRotation=r=>(o.rotation=r,o);o.setScale=k=>(o.scale=k,o);o.setAlpha=a=>(o.alpha=a,o);o.destroy=()=>o.destroyed=true;objects.push(o);return o;};const g={fillStyle(){return this;},fillPoints(points){for(const p of points)assert(Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<128&&p.y>=0&&p.y<64);return this;},lineStyle(){return this;},strokePoints(){return this;},generateTexture(k,w,h){assert.equal(w*h*4,32768);bakes++;textures.set(k,{add(){}});},destroy(){}};
 return {objects,events,add:{image},make:{graphics:()=>g},textures:{exists:k=>textures.has(k),get:k=>textures.get(k)}};
}
for(reduced of [false,true])for(let cycle=0;cycle<20;cycle++){
 const s=scene(),fx=new exp.CombatSymbols(s);assert.equal(s.objects.length,12);assert(s.objects.every(o=>o.depth===69));
 fx.sweet(400,220);let stars=s.objects.filter(o=>o.visible);assert.equal(stars.length,1,'one star per sweet event');assert.equal(stars[0].frame,'sweet-star');const y=stars[0].y;
 s.events.emit('update',0,100);if(reduced)assert.equal(stars[0].y,y);else assert(stars[0].y<y);assert(Number.isFinite(stars[0].alpha));
 for(let i=0;i<1000;i++){fx.sweet(i%800,200);fx.chargeLost(i%800,200);s.events.emit('update',i,1);assert(fx.diagnostics().activeSweetStars<=8);assert(fx.diagnostics().activeChargeLossBolts<=4);}
 assert.equal(s.objects.length,12);s.events.emit('update',2000,400);assert(s.objects.every(o=>!o.visible));fx.sweet(1,2);fx.chargeLost(3,4);s.events.emit('shutdown');assert(s.objects.every(o=>o.destroyed));assert.equal(s.events.listenerCount('update'),0);fx.destroy();fx.sweet(1,2);
}
assert.equal(bakes,1);assert.equal(textures.size,1);
console.log('PASS: one sweet star/event, 8star+4charge-loss capacity, shared32KiB atlas, 40 lifecycles/80000 reused symbols, reduced motion, worlddepth69 and shutdown');
