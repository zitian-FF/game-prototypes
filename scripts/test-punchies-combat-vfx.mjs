import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import EventEmitter from 'eventemitter3';
const exports={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/render/combatVfx.ts','utf8'),
 {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports});
const events=new EventEmitter(),objects=[];
function graphics(){const g={visible:true,active:true,points:[],rotation:0};
 for(const m of ['setDepth','setAlpha','setScale','fillStyle','lineStyle'])g[m]=()=>g;
 g.setPosition=(x,y)=>(Object.assign(g,{x,y}),g);g.setRotation=r=>(g.rotation=r,g);g.setVisible=v=>(g.visible=v,g);
 g.clear=()=>(g.points=[],g);g.fillPoints=g.strokePoints=p=>{assert(p.every(v=>Number.isFinite(v.x)&&Number.isFinite(v.y)));g.points.push(p);return g;};
 g.destroy=()=>{g.active=false;};objects.push(g);return g;}
for(let run=0;run<20;run++){
 const before=objects.length,pool=new exports.CombatSparks({events,add:{graphics}});
 for(let hit=0;hit<1000;hit++)pool.burst(420,210,0,1,1.25,[0xffffff,0xfff27a,0xffc83a],10);
 assert.equal(objects.length-before,8,'repeated hits must not allocate extra graphics');
 assert.equal(pool.diagnostics().activeSparks,8,'simultaneous effects have a hard cap');
 assert(objects.slice(before).every(g=>g.x===420&&g.y===210&&g.rotation===Math.PI/2));
 events.emit('update',1000,300);
 assert.equal(pool.diagnostics().activeSparks,0);assert(objects.slice(before).every(g=>!g.visible&&g.points.length===0));
 pool.burst(1,2,-1,0,.5625,[0xffffff,0xfff27a,0xffc83a],4);
 events.emit('shutdown');assert.equal(events.listenerCount('update'),0);assert(objects.slice(before).every(g=>!g.active));
 pool.destroy();pool.burst(0,0,1,0,1,[0,0,0],1);assert.equal(pool.diagnostics().activeSparks,0);
}
const flame=graphics(),rig={uppercutFireFlickerHz:12,uppercutFireWidth:14,uppercutFireLength:22};
for(const [root,fist] of [[{x:0,y:0},{x:40,y:0}],[{x:0,y:0},{x:0,y:-40}],[{x:0,y:0},{x:0,y:0}]]){
 for(const intensity of [0,.2,1]){flame.clear();exports.drawUppercutFlame(flame,root,fist,intensity,250,1.25,rig);if(intensity===0)assert.equal(flame.points.length,0);}
}
console.log('PASS: 20 shutdown cycles ×1000 impacts, fixed 8-object pool, expiration, world positions/direction, zero VFX tweens/textures, safe flame geometry');
