import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundle = await build({stdin:{contents:`export * from './prototypes/punchies/src/render/punchMotion'; export * from './prototypes/punchies/src/sim/sim'; export {punchCfg} from './prototypes/punchies/src/sim/character'; export {tune} from './prototypes/punchies/src/sim/tune';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false});
const {createSimState,step,punchCfg,punchFist,punchExtension,armPose,gloveRegistration,uppercutFireIntensity,tune,activeEnd,punchPoint}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const neutral={mx:0,my:0,jab:false,cross:false,hook:false,uppercut:false,dodge:false,guard:false};
const near=(a,b)=>assert(Math.abs(a-b)<1e-9);
for(const char of ['marco','mia','bruno','tee']) for(const type of ['jab','cross','hook','uppercut']) {
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

for(const char of ['marco','mia','bruno','tee'])for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2,.7])for(const side of [-1,1]) {
 const r=gloveRegistration(char,120,96,1.32),fist={x:60*Math.cos(angle),y:60*Math.sin(angle)};
 const shoulder={x:-Math.sin(angle)*13*side,y:Math.cos(angle)*13*side};
 const {elbow,wrist}=armPose(shoulder,fist,r.cuff,9,{x:-Math.sin(angle)*side,y:Math.cos(angle)*side},0);
 const rot=Math.atan2(fist.y-elbow.y,fist.x-elbow.x)+r.axis;
 const local=char==='tee'?{x:-r.cuff,y:0}:{x:0,y:r.cuff};
 near(fist.x+local.x*Math.cos(rot)-local.y*Math.sin(rot),wrist.x);
 near(fist.y+local.x*Math.sin(rot)+local.y*Math.cos(rot),wrist.y);
}
assert.equal(gloveRegistration('tee',120,96,1).axis,0);
for(const kind of ['jab','cross','hook','uppercut']){
 assert.equal(tune.characters.tee[kind].startup,tune.characters.mia[kind].startup);
 assert.equal(tune.characters.tee[kind].recovery,tune.characters.mia[kind].recovery);
 near(tune.characters.tee[kind].damage/tune.characters.bruno[kind].damage,.95);
}
assert(tune.characters.tee.stun<.7);assert(tune.characters.tee.speed>tune.characters.mia.speed);assert(tune.view.puppet.teeWalkRate>1);
console.log('PASS: Tee right-facing fists meet cuff/forearm on both hands across facings; Mia punch timing, 5% below Bruno power, lower stun resistance and faster footwork.');
