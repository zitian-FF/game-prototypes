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
const textures=new Map();let bakes=0,frames=0,refresh=0;
const g={clear(){return this;},fillStyle(){return this;},lineStyle(){return this;},fillPoints(){return this;},strokePoints(){return this;},destroy(){},generateTexture(key){bakes++;textures.set(key,{getSourceImage:()=>({})});}};
const image=()=>{const o={};for(const m of ['setOrigin','setPosition','setScale','setAlpha','setVisible','setFrame'])o[m]=()=>o;return o;};
const scene={make:{graphics:()=>g},add:{image},textures:{exists:k=>textures.has(k),get:k=>textures.get(k),remove:k=>textures.delete(k),createCanvas(k,w,h){textures.set(k,{context:{drawImage(){}},add(){frames++;},refresh(){refresh++;}});assert.equal(w*h*4,3686400);}}};
for(let cycle=0;cycle<20;cycle++)exports.clashFireImage(scene);
assert.equal(bakes,16);assert.equal(frames,16);assert.equal(refresh,1);assert.equal(textures.size,1,'one shared atlas, scratch frames removed');
console.log('PASS: 20 intros share one 16-frame/3.52MiB atlas; zero runtime path rebuilds or scratch texture growth');
