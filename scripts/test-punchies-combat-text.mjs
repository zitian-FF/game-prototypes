import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import EventEmitter from 'eventemitter3';
const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/render/combatText.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:()=>({PIXEL_RATIO:1})});
for(let cycle=0;cycle<20;cycle++){
 const events=new EventEmitter(),objects=[];const text=()=>{const o={destroyed:false};for(const m of ['setOrigin','setDepth','setVisible','setStyle','setText','setPosition','setAlpha','setScale'])o[m]=()=>o;o.destroy=()=>o.destroyed=true;objects.push(o);return o;};
 const p=new exports.CombatText({events,add:{text}});
 for(let i=0;i<1000;i++){p.show('damage',1,2,'5','#fff',17);p.show('label',1,2,'sweet','#ff0',12);events.emit('update',i,16);}
 assert.equal(objects.length,20);assert(p.diagnostics().activeCombatText<=20);assert.equal(p.diagnostics().combatTextTweens,0);
 events.emit('update',10000,1000);assert.equal(p.diagnostics().activeCombatText,0);events.emit('shutdown');assert.equal(events.listenerCount('update'),0);assert(objects.every(o=>o.destroyed));
}
console.log('PASS: combat text capped20, no tweens, 20 scene lifecycles and 40000 reused impact labels/numbers');
