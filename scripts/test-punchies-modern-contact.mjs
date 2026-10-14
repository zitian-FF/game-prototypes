import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import ts from 'typescript';
const cache=new Map();function load(file){file=path.resolve(file);if(!fs.existsSync(file)&&file.endsWith('.ts'))file=path.join(file.slice(0,-3),'index.ts');if(cache.has(file))return cache.get(file);if(file.endsWith('.json'))return{default:JSON.parse(fs.readFileSync(file,'utf8'))};const exports={};cache.set(file,exports);vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,structuredClone,console,setTimeout,clearTimeout,require:id=>load(path.resolve(path.dirname(file),id.endsWith('.json')?id:id+'.ts'))});return exports;}
const root='prototypes/punchies/src/',sim=load(root+'sim/sim.ts'),m=load(root+'sim/modernControls.ts'),char=load(root+'sim/character.ts'),g=load(root+'sim/geometry.ts'),{tune}=load(root+'sim/tune.ts'),N=load(root+'sim/types.ts').NEUTRAL_INPUT;
const tuneBefore=JSON.stringify(tune),rows=[],walking={sweet:0,sour:0,whiff:0},retreat={sweet:0,sour:0,whiff:0};
function setup(attacker,target,control='modern'){const state=sim.createSimState({timed:false,fighters:[{char:attacker,controlMode:control},{char:target,controlMode:'classic',anchored:true}]}),[a,b]=state.fighters;a.x=360;a.y=b.y=200;b.health=10000;return state;}
function trace(attacker,target,distance,{control='modern',type='cross',walkFrom=Infinity,retreating=false,vulnerable=false,guard=false}={}){
 const s=setup(attacker,target,control),[a,b]=s.fighters;b.x=a.x+distance;b.anchored=!Number.isFinite(walkFrom);b.forceVulnerable=vulnerable;if(guard){b.guarding=true;b.guardFrames=100;}let thrown=null,hit=null;
 for(let tick=0;tick<120;tick++){
  const input=tick===0?{...N,normalAttack:control==='modern',[type]:control==='classic'}:N;
  const events=sim.step(s,[input,{...N,guard,mx:tick>=walkFrom?(retreating?100:-100):0}],false);
  if(events.some(e=>e.kind==='throw'))thrown=a.punch.type;
  const event=events.find(e=>(e.kind==='hit'||e.kind==='block')&&e.attacker===0);
  if(event){const p=a.punch,frame=p.frame-1;hit={tick,frame,sweet:event.sweet,phase:sim.phaseOf({...p,frame}),centerDistance:+Math.hypot(b.x-a.x,b.y-a.y).toFixed(4),fistReach:+sim.currentReach({...p,frame}).toFixed(4),damage:event.damage??event.chip,kind:event.kind};break;}
  if(tick>0&&!a.punch)break;
 }return{attacker,target,initialDistance:+distance.toFixed(4),thrown,hit};
}
for(const attacker of char.CHARACTER_IDS)for(const target of char.CHARACTER_IDS){
 const s=setup(attacker,target),[a,b]=s.fighters,z=m.modernPunchZones(a,b),J=char.punchCfg(a,'jab'),C=char.punchCfg(a,'cross');
 assert(z.bodyContact<z.hookMax&&z.hookMax<z.jabMax&&z.jabMax<z.crossContactMax,'nonempty reachable zones '+attacker+'/'+target);
 assert(z.jabMax<=J.reach+J.hitRadius+g.normalHurtRadius(b),'no widened Jab contact gap '+attacker+'/'+target);
 const hook=trace(attacker,target,z.bodyContact);assert.equal(hook.thrown,'hook');assert(hook.hit,'Hook actually connects at legal body separation');
 const jab=trace(attacker,target,(z.hookMax+z.jabMax)/2);assert.equal(jab.thrown,'jab');assert(jab.hit,'Jab middle band connects');
 const cross=trace(attacker,target,z.jabMax+.01);assert.equal(cross.thrown,'cross');assert(cross.hit?.sweet,'stationary near-boundary Cross reaches sweet instead of early core');
 const outer=trace(attacker,target,z.crossContactMax-.01);assert.equal(outer.thrown,'cross');assert(outer.hit?.sweet,'full body contact Cross is sweet');
 const whiff=trace(attacker,target,z.crossMax-.01);assert.equal(whiff.thrown,'cross');assert.equal(whiff.hit,null,'anticipation band does not fake stationary contact');
 const walk=trace(attacker,target,z.crossMax-.01,{walkFrom:0});walking[walk.hit?(walk.hit.sweet?'sweet':'sour'):'whiff']++;
 const headDistance=(z.jabMax+C.reach+C.hitRadius+g.coreRadius(b))/2;
 const clean=trace(attacker,target,headDistance),classic=trace(attacker,target,headDistance,{control:'classic'});assert(clean.hit?.sweet&&classic.hit?.sweet);assert(Math.abs(clean.hit.damage-classic.hit.damage*.8)<1e-8,'unchanged Classic geometry and Modern multiplier');
 const away=trace(attacker,target,headDistance,{walkFrom:0,retreating:true});retreat[away.hit?(away.hit.sweet?'sweet':'sour'):'whiff']++;assert.equal(away.thrown,'cross');
 rows.push({attacker,target,zones:z,hook,jab,cross,outer,walk,retreat:away});
}
for(const name of ['marco','mia','bruno']){
 const s=setup(name,'marco'),[a,b]=s.fighters;b.x=a.x+100;for(let tick=0;tick<160;tick++)sim.step(s,[{...N,mx:100},N],false);assert(Math.abs(b.x-a.x-g.separation(a,b))<1e-6,'actual approach stops at body collision');const events=sim.step(s,[{...N,normalAttack:true},N],false);assert(events.some(e=>e.kind==='throw'));assert.equal(a.punch.type,'hook','closest approach is now a legal Hook');
 const z=m.modernPunchZones(a,b),crossDistance=(z.jabMax+char.punchCfg(a,'cross').reach+char.punchCfg(a,'cross').hitRadius+g.coreRadius(b))/2;
 assert(trace(name,'marco',crossDistance,{vulnerable:true}).hit?.sweet,'vulnerable target respects trajectory timing');
 assert.equal(trace(name,'marco',crossDistance,{guard:true}).hit?.kind,'block','guard still blocks through the actual resolver');
 const close=trace(name,'marco',z.bodyContact,{control:'classic',type:'hook'});assert(close.hit);assert.equal(close.hit.sweet,false,'Classic close jam remains sour rather than relabeled');
}
assert.equal(JSON.stringify(tune),tuneBefore,'no global tune changes');
const report={pairs:rows.length,walking,retreat,examples:rows.filter(row=>row.target==='marco'&&['marco','mia','bruno','roxy','nadia'].includes(row.attacker))};
fs.mkdirSync('outputs',{recursive:true});fs.writeFileSync('outputs/modern-contact-zone-runtime-proof.json',JSON.stringify(report,null,2));
console.log('PASS actual contact simulation across '+rows.length+' roster size pairs: reachable Hook, nonempty Jab, stationary sweet Cross, real walk-in/retreat, anticipation whiff, anchored approach, guard/vulnerability, Classic parity and unchanged tune.');console.log(JSON.stringify({walking,retreat,examples:report.examples.map(x=>({attacker:x.attacker,zones:x.zones,hook:x.hook.hit,cross:x.cross.hit,walk:x.walk.hit}))},null,2));
