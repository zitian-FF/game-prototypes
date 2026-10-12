import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
const exp={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/ui/vsStamp.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exp,Math});
const cfg=JSON.parse(fs.readFileSync('prototypes/punchies/tune.json','utf8')).view.fightPresentation,before=JSON.stringify(cfg);
assert.equal(exp.vsStampFrame(0,cfg,true).visible,false);assert.equal(exp.vsStampFrame(cfg.portraitSlideMs,cfg,true).visible,false);
const landed=exp.vsStampFrame(cfg.portraitSlideMs+cfg.impactMs,cfg,true);assert.equal(landed.scale,1);assert.equal(landed.opacity,1);
const approach=exp.vsStampFrame(cfg.showcaseMs-cfg.vsExitMs,cfg,true);assert(approach.scale>landed.scale);assert.equal(approach.opacity,1);
const fade=exp.vsStampFrame(cfg.showcaseMs-cfg.vsExitMs/2,cfg,true);assert(Math.abs(fade.opacity-.5)<1e-10);assert(fade.scale>approach.scale);
assert.equal(exp.vsStampFrame(cfg.showcaseMs,cfg,true).complete,true);assert.equal(exp.vsStampFrame(cfg.showcaseMs,cfg,true).opacity,0);
for(let ms=0;ms<cfg.showcaseMs;ms+=17){const f=exp.vsStampFrame(ms,cfg,false);assert.equal(f.x,0);assert.equal(f.y,0);assert(f.scale<=1.08);for(const v of Object.values(f))if(typeof v==='number')assert(Number.isFinite(v));}
assert.equal(JSON.stringify(cfg),before,'does not alter shared showcase/control timing');
const textures=new Map();let renders=0,destroys=0,refreshes=0;const ctx={drawImage(){},createLinearGradient:()=>({addColorStop(){}}),fillRect(){}};
const image=()=>{const o={};o.setScale=x=>(o.scale=x,o);o.setOrigin=()=>o;return o;};
const scene={textures:{exists:k=>textures.has(k),createCanvas(k,w,h){assert(w*h*4<1024*1024);const t={context:ctx,refresh(){refreshes++;}};textures.set(k,t);return t;}},make:{text(){renders++;return{canvas:{width:500,height:340},destroy(){destroys++;}};}},add:{image}};
for(let i=0;i<20;i++)assert.equal(exp.createVsStamp(scene).scale,.5);assert.equal(renders,1);assert.equal(destroys,1);assert.equal(refreshes,1);assert.equal(textures.size,1);
const source=fs.readFileSync('prototypes/punchies/src/ui/fightPresentation.ts','utf8');assert(!source.includes('clashFire')&&!source.includes('flames'),'no fire flow/resource');
console.log('PASS: cached one-image VS, stamp/approach/vibration/crossfade, fixed shared1800ms timeline, reduced motion and zero fire resources');
const {default:EventEmitter}=await import('eventemitter3');
const presentation={};const VIEW={cx:422,cy:195,width:844,height:390,top:0,bottom:390};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/ui/fightPresentation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:presentation,require:id=>id.includes('vsStamp')?exp:id==='phaser'?{default:{Math:{Easing:{Cubic:{Out:x=>1-Math.pow(1-x,3)}}}}}:id.includes('pixelRatio')?{VIEW,PIXEL_RATIO:1}:id.includes('sim/tune')?{tune:{view:{fightPresentation:cfg}}}:id.includes('render/art')?{artImage:()=>null}:id.includes('render/skins')?{skinTexture:()=>null}:id.includes('sim/character')?{charName:x=>x}:id.includes('presentation')?{reducedMotion:()=>false}:{}});
for(let i=0;i<20;i++){
 const objects=[],events=new EventEmitter();const obj=()=>{const o={list:[],width:120,scaleX:1};for(const m of ['setDepth','setOrigin','setAngle','setInteractive','setVisible'])o[m]=()=>o;o.setScale=x=>(o.scaleX=x,o);o.setPosition=(x,y)=>(o.x=x,o.y=y,o);o.setAlpha=x=>(o.alpha=x,o);o.add=x=>(o.list.push(x),o);o.addAt=(x,j)=>(o.list.splice(j,0,x),o);o.destroy=()=>{o.destroyed=true;o.list.forEach(c=>c.destroy());};objects.push(o);return o;};
 const scene={events,add:{container:obj,rectangle:obj,text:obj,image:obj},textures:{exists:k=>k==='punchies:vs-stamp-v1'}};
 const intro=new presentation.MatchIntro(scene,['marco','mia']);intro.draw(800);assert.equal(events.listenerCount('shutdown'),1);const count=objects.length;
 intro.draw(1650);assert(objects[0].alpha>0&&objects[0].alpha<1);assert.equal(objects.length,count,'draw creates no objects');
 if(i%2)events.emit('shutdown');else intro.draw(cfg.showcaseMs);
 assert(objects[0].destroyed);assert.equal(events.listenerCount('shutdown'),0);intro.draw(800);assert.equal(objects.length,count);
}
console.log('PASS: 20 actual MatchIntro normal/early-exit lifecycles, cover crossfade, zero draw-time objects and shutdown cleanup');
