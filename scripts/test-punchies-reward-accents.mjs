import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import EventEmitter from 'eventemitter3';
let motion=false;const exports={},textures=new Map();let bakes=0;
vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/ui/rewardAccents.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Math,require:id=>id.includes('pixelRatio')?{VIEW:{width:844,height:390,left:0,right:844,top:0}}:{reducedMotion:()=>motion}});
function scene(){const objects=[],events=new EventEmitter();const make=()=>{const o={width:240,height:96,displayWidth:240,alpha:1,scale:1,destroyed:false,list:[]};
 for(const m of ['setTint','setRotation','setVisible','setDepth','setCrop'])o[m]=(...args)=>(o[m+'Args']=args,o);
 o.setPosition=(x,y)=>(o.x=x,o.y=y,o);o.setScale=(x,y=x)=>(o.scaleX=x,o.scaleY=y,o);o.setAlpha=x=>(o.alpha=x,o);
 o.setDisplaySize=(w,h)=>(o.displayWidth=w,o.displayHeight=h,o);o.add=x=>(o.list.push(...(Array.isArray(x)?x:[x])),o);
 o.remove=x=>(o.list=o.list.filter(v=>v!==x),o);
 o.destroy=children=>{o.destroyed=true;if(children)o.list.forEach(x=>x.destroy(true));};objects.push(o);return o;};
 const graphics=()=>{const g=make();for(const m of ['fillStyle','fillPoints','lineStyle','strokePoints'])g[m]=()=>g;g.generateTexture=k=>{bakes++;textures.set(k,{add(){}});};return g;};
 return {objects,events,add:{container:make,image:make},make:{graphics},textures:{exists:k=>k==='chest'||textures.has(k),get:k=>textures.get(k)}};
}
for(motion of [false,true])for(let cycle=0;cycle<20;cycle++){
 const s=scene(),parent=s.add.container(),p=new exports.PullAccents(s,parent,422,200,cycle%2===0,'chest');
 p.bringHighlightForward(parent);assert(s.objects.length<=12);for(let t=0;t<800;t+=16)s.events.emit('update',t,16);
 assert.equal(s.events.listenerCount('update'),0);assert(parent.list.every(o=>o.destroyed));
 const s2=scene(),v=new exports.VictoryAccent(s2,600,70,250);assert.equal(s2.objects.length,8);
 for(let t=0;t<750;t+=16)s2.events.emit('update',t,16);assert.equal(s2.events.listenerCount('update'),0);assert(s2.objects.every(o=>o.destroyed));
 const early=scene();new exports.PullAccents(early,early.add.container(),0,0,true,'chest');new exports.VictoryAccent(early,0,0,200);early.events.emit('shutdown');assert.equal(early.events.listenerCount('update'),0);
}
assert.equal(bakes,1);assert.equal(textures.size,1);
assert.equal(exports.pullAccentPhase(100,true).burstAlpha,0);assert.equal(exports.pullAccentPhase(180,true).release,0);assert.equal(exports.pullAccentPhase(750,true).done,true);
for(let t=0;t<1000;t++){const p=exports.pullAccentPhase(t,true);for(const [k,v] of Object.entries(p))if(typeof v==='number')assert(Number.isFinite(v),k);}
console.log('PASS: shared0.5MiB atlas, pull<=10 and victory8objects, finite phases, reduced motion, 40 lifecycle/early shutdown cleanups');
