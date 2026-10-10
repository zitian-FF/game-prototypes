import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/render/art.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
  exports,__PUNCHIES_ART__:{manifest:[],animations:{}},__PUNCHIES_ASSET_BASE__:'/',
  require:key=>key==='phaser'?{default:{Scene:class{}}}:{}
});
function render(name,height,exists=true){
  const image={width:462,height,setDisplaySize(w,h){this.displayWidth=w;this.displayHeight=h;return this;},setDepth(){return this;},setOrigin(x,y){this.originX=x;this.originY=y;return this;}};
  return exports.artImage({textures:{exists:()=>exists},add:{image:()=>image}},name,100,100,250,71);
}
const v4=render('logo',145),prior=render('logo',131);
assert.equal(v4.displayWidth,prior.displayWidth);
assert.equal(v4.displayHeight/145,prior.displayHeight/131,'existing logo pixels retain their vertical scale');
assert.equal(v4.originY*145,65.5,'original pixel pivot stays fixed');
assert.equal(v4.displayHeight*v4.originY,35.5,'existing top position stays fixed');
assert.equal(render('chest_skin_base',145).displayHeight,71,'unrelated image sizing is unchanged');
assert.equal(render('logo',145,false),null);
console.log('PASS: padded logo preserves artwork scale and pixel pivot, includes bottom extrusion, and leaves other images unchanged.');
