import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import EventEmitter from 'eventemitter3';
let reduced=false,bakes=0;const textures=new Map(),exp={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/ui/superMeterLightning.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exp,Math,require:()=>({reducedMotion:()=>reduced})});
function scene(){const objects=[],events=new EventEmitter();const make=()=>{const o={visible:true,list:[],destroyed:false};o.add=x=>(o.list.push(...x),o);o.setDepth=x=>(o.depth=x,o);o.setVisible=x=>(o.visible=x,o);o.setFlipX=()=>o;o.setPosition=(x,y)=>(o.x=x,o.y=y,o);o.setDisplaySize=(w,h)=>(o.w=w,o.h=h,o);o.setRotation=x=>(o.rotation=x,o);o.setFrame=x=>(o.frame=x,o);o.setAlpha=x=>(o.alpha=x,o);o.destroy=()=>{o.destroyed=true;o.list.forEach(c=>c.destroy());};objects.push(o);return o;};const g={clear(){return this;},lineStyle(){return this;},lineBetween(x1,y1,x2,y2){for(const v of [x1,y1,x2,y2])assert(Number.isFinite(v));return this;},generateTexture(k,w,h){bakes++;assert.equal(w*h,128*24);textures.set(k,{getSourceImage:()=>({})});},destroy(){}};
 return {objects,events,add:{container:make,image:make},make:{graphics:()=>g},textures:{exists:k=>textures.has(k),get:k=>textures.get(k),remove:k=>textures.delete(k),createCanvas(k,w,h){assert.equal(w*h*4,98304);const a={context:{drawImage(){}},add(){},refresh(){}};textures.set(k,a);return a;}}};}
for(reduced of [false,true])for(let cycle=0;cycle<20;cycle++){
 const s=scene(),r={x:250,y:58,width:76,height:24},fx=new exp.SuperMeterLightning(s,r);assert.equal(s.objects.length,3);assert.equal(s.objects[0].visible,false);
 fx.setReady(true);s.events.emit('update',0,170);const a=s.objects[1];assert(a.alpha>=.65&&a.alpha<=.92);if(reduced)assert.equal(a.frame,'0');
 assert(a.x+a.h/2<r.x,'left bolt outside protected interior');assert(s.objects[2].x-s.objects[2].h/2>r.x+r.width);
 const next={x:190,y:58,width:102,height:24};fx.setBounds(next);assert.equal(a.x,185);
 fx.setReady(false);assert.equal(s.objects[0].visible,false);const frame=a.frame;s.events.emit('update',1000,500);assert.equal(a.frame,frame,'unready lightning stops');
 fx.setReady(true);assert.equal(a.frame,'0');s.events.emit('shutdown');assert.equal(s.events.listenerCount('update'),0);assert(s.objects.every(o=>o.destroyed));fx.destroy();fx.setReady(true);
}
assert.equal(textures.size,1);assert.equal(bakes,8);
console.log('PASS: shared96KiB/8frame atlas,40 scene lifecycles,3objects/meter, protected interior, immediate stop/spend/restart, reduced motion and shutdown');
