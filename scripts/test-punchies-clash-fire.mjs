import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=fs.readFileSync('prototypes/punchies/src/ui/clashFire.ts','utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const exports={};vm.runInNewContext(code,{exports,Math});
function frame(ms,scale,motion,reveal=1){
 const polygons=[];let clears=0;
 const g={clear(){clears++;return this;},fillStyle(){return this;},lineStyle(){return this;},
  fillPoints(p){polygons.push(p);return this;},strokePoints(){return this;}};
 exports.drawClashFire(g,320,192,ms,scale,motion,reveal);
 assert.equal(clears,1);
 assert.ok(polygons.length<=41,'bounded shapes, no growth');
 for(const p of polygons)for(const v of p){assert.ok(Number.isFinite(v.x)&&Number.isFinite(v.y));assert.ok(Math.abs(v.x-320)<400&&Math.abs(v.y-192)<400);}
 return polygons;
}
assert.equal(frame(0,1,true,0).length,0,'clears before reveal');
assert.deepEqual(frame(0,1,false),frame(3000,1,false),'reduced motion remains static');
assert.notDeepEqual(frame(1000,1,true),frame(1100,1,true),'flames animate');
for(let ms=0;ms<10000;ms+=17)frame(ms,1.8,true);
console.log('Clash flame geometry finite/bounded, animated, hidden before reveal and static for reduced motion');
