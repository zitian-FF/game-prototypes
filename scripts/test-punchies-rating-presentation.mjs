import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/ui/ratingPresentation.ts','utf8'),
 {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
 {exports,require:()=>({PIXEL_RATIO:1})});
const translate=(key,p)=>key+JSON.stringify(p??{});
assert.match(exports.ratingLabel({phase:'settled',rating:1004,delta:4},translate),/\+4/);
assert.match(exports.ratingLabel({phase:'settled',rating:996,delta:-4},translate),/-4/);
assert.match(exports.ratingLabel({phase:'settled',rating:1000,delta:0},translate),/"0"/);
assert.match(exports.ratingLabel({phase:'available',rating:NaN},translate),/^rating.unavailable/);
assert.match(exports.ratingLabel({phase:'unavailable'},translate),/^rating.unavailable/);
const label={width:0,height:0,scale:1,setOrigin(){return this;},setDepth(){return this;},
 setScale(v){this.scale=v;return this;},setText(s){this.width=s.length*9;this.height=Math.ceil(this.width/188)*20;return this;}};
const status=exports.ratingStatusText({add:{text:()=>label}},0,0,200,155);
status.set('Long translated rating message '.repeat(8));
assert(label.width*label.scale<=200&&label.height*label.scale<=42,'long status must fit its allocated bounds');
status.set('1000');assert.equal(label.scale,1,'shorter updates restore full size');
console.log('Rating presentation: honest unavailable, signed deltas, bounded long status and restored text size passed');
