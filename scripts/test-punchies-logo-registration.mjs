import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/render/art.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
  exports,__PUNCHIES_ART__:{manifest:[],animations:{}},__PUNCHIES_ASSET_BASE__:'/',
  require:key=>key==='phaser'?{default:{Scene:class{}}}:{}
});
function render(name,height,exists=true,width=462){
  const image={width,height,setDisplaySize(w,h){this.displayWidth=w;this.displayHeight=h;return this;},setDepth(){return this;},setOrigin(x,y){this.originX=x;this.originY=y;return this;}};
  return exports.artImage({textures:{exists:()=>exists},add:{image:()=>image}},name,100,100,250,71);
}
const compact=render('logo',145),standard=render('logo',290,true,924);
assert.equal(compact.displayWidth,standard.displayWidth);
assert.equal(compact.displayHeight,standard.displayHeight,'profiles have identical complete-logo registration');
assert.equal(compact.displayWidth/462,compact.displayHeight/145,'wordmark never stretches');
assert.equal(compact.originY,.5);
assert.equal(standard.originY,.5);
assert.equal(render('chest_skin_base',145).displayHeight,71,'unrelated image sizing is unchanged');
assert.equal(render('logo',145,false),null);
console.log('PASS: complete canonical logo keeps natural aspect, consistent profile registration and unrelated image sizing.');
