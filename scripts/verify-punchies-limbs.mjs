import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundle = await build({stdin:{contents:`export * from './prototypes/punchies/src/render/punchMotion'; export * from './prototypes/punchies/src/sim/sim'; export {punchCfg} from './prototypes/punchies/src/sim/character'; export {tune} from './prototypes/punchies/src/sim/tune';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false});
const {createSimState,step,punchCfg,punchFist,punchExtension,armPose,uppercutFireIntensity,tune,activeEnd,punchPoint}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const neutral={mx:0,my:0,jab:false,cross:false,hook:false,uppercut:false,dodge:false,guard:false};
const near=(a,b)=>assert(Math.abs(a-b)<1e-9);
for(const char of ['marco','mia','bruno']) for(const type of ['jab','cross','hook','uppercut']) {
 const s=createSimState({timed:false,fighters:[{char},{anchored:true}]});const f=s.fighters[0];f.stars=tune.stars.max;step(s,[{...neutral,[type]:true},neutral]);const p=f.punch;
 for(let frame=0;frame<activeEnd(p)+p.recovery;frame++) {
  p.frame=frame;const before=JSON.stringify(s);const v=punchFist(f,p,1);assert(Number.isFinite(v.x)&&Number.isFinite(v.y));assert.equal(JSON.stringify(s),before,'presentation math must never mutate simulation');
 }
 p.frame=p.startup+p.sourEarly;
 const glove=punchFist(f,p,1),contact=punchPoint(f,p);near(glove.x,contact.x);near(glove.y,contact.y);
 if(type==='jab'||type==='cross') {
  const side=p.hand===0?1:-1;const shoulder={x:f.x+f.fx+f.fy*tune.view.puppet.shoulderSpread*side,y:f.y+f.fy-f.fx*tune.view.puppet.shoulderSpread*side};
  const {elbow,wrist}=armPose(shoulder,glove,tune.view.puppet.gloveHeight*.4,9,{x:f.fy*side,y:-f.fx*side},punchExtension(p));
  near((elbow.x-shoulder.x)*(wrist.y-shoulder.y)-(elbow.y-shoulder.y)*(wrist.x-shoulder.x),0);
  near(Math.hypot(glove.x-wrist.x,glove.y-wrist.y),tune.view.puppet.gloveHeight*.4);
 }
 if(type==='hook') {
  f.fx=1;f.fy=0;p.frame=p.startup-1;const left=punchFist(f,{...p,hand:0},1),right=punchFist(f,{...p,hand:1},1);near(left.x,right.x);near(left.y-f.y,-(right.y-f.y));
  p.frame=p.startup;const early=punchFist(f,p,1);p.frame=p.startup+p.sourEarly+1;const follow=punchFist(f,p,1);assert((early.y-f.y)*(follow.y-f.y)<0,'hook must sweep across facing, not slide out and back');
  p.frame=activeEnd(p)-1;const last=punchFist(f,p,1);p.frame++;const recovery=punchFist(f,p,1);near(last.x,recovery.x);near(last.y,recovery.y);
 }
 if(type==='uppercut') {
  p.frame=p.startup+p.sourEarly;assert.equal(uppercutFireIntensity(p),1,'flames cover the contact pose');p.frame=activeEnd(p)+tune.view.puppet.uppercutFireFadeFrames;assert.equal(uppercutFireIntensity(p),0,'flames clear during recovery');
 }
}
near(tune.view.puppet.walkPhasePerPixel/.35,.6);
console.log('PASS: straight jab/cross arms and cuff alignment, mirrored hook arc/continuous recovery, contact alignment, fire coverage/expiry, 40% slower gait, and read-only presentation math for all characters.');
