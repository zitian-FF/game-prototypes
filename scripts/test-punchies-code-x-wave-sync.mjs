import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import assert from 'node:assert/strict';
const compile=p=>ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const cfg=JSON.parse(fs.readFileSync('prototypes/punchies/src/sim/super-config.json','utf8')),helper={};vm.runInNewContext(compile('prototypes/punchies/src/sim/codeX.ts'),{exports:helper,require:()=>({default:cfg})});assert.equal(helper.CODE_X_TIMING.dash,6);
let quiet=false;const sheet={dark:'dark',cyan:'cyan',purple:'purple',pivotX:.8,pivotY:.5},objects=[],events={once(){},off(){}};
function image(){const o={visible:false};for(const k of ['setDepth','setTexture','setFrame','setOrigin','setPosition','setRotation','setTintFill','setTint','setScale','setAlpha','setDisplaySize'])o[k]=(...args)=>(o[k+'Args']=args,o);o.setVisible=v=>(o.visible=v,o);o.destroy=()=>{o.dead=true;};objects.push(o);return o;}
const render={};vm.runInNewContext(compile('prototypes/punchies/src/render/codeXShadows.ts'),{exports:render,require:id=>id.includes('codeXShadowSheet')?{codeXShadowSheet:()=>sheet,codeXTrailTexture:()=> 'trail'}:id.includes('sim/codeX')?helper:{reducedMotion:()=>quiet}});
const renderer=new render.CodeXShadows({events,add:{image}});
for(const [fx,fy] of [[1,0],[0,1]]){const tracks=helper.codeXTracks(400,200,fx,fy,60),state={frame:0,tracks};const f={health:100,codeX:state};renderer.draw([f]);assert(objects.slice(0,12).every(o=>!o.visible),'no long-lived telegraph silhouette');
 for(let i=0;i<2;i++){const track=tracks[i];assert((track.startX-400)*fx+(track.startY-200)*fy>0,'starts on defender-facing front diagonals');state.frame=track.startFrame+3;renderer.draw([f]);const body=objects[i*6+1];assert.deepEqual(body.setPositionArgs,[400,200],'striking glove crosses the locked center on typed track');assert.deepEqual(body.setOriginArgs,[.8,.5]);const count=objects.length;renderer.draw([f]);assert.equal(objects.length,count,'hitstop redraw does not allocate');}
 state.frame=tracks[1].startFrame+6+4;renderer.draw([f]);assert(objects.slice(0,12).every(o=>!o.visible),'X visual fades within four recovery ticks');
}
quiet=true;renderer.draw([]);assert(objects.every(o=>!o.visible));renderer.destroy();assert(objects.every(o=>o.dead));
console.log('PASS revised CODE X: defender-front diagonals, six-tick sharedpaths/contactpivot, quick fades, hitstop/no allocations and cleanup');
