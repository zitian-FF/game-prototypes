import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import ts from 'typescript';
const cache=new Map();
function load(file){file=path.resolve(file);if(!fs.existsSync(file)&&file.endsWith('.ts'))file=path.join(file.slice(0,-3),'index.ts');if(cache.has(file))return cache.get(file);if(file.endsWith('.json'))return {default:JSON.parse(fs.readFileSync(file,'utf8'))};const exports={};cache.set(file,exports);vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,structuredClone,console,setTimeout,clearTimeout,require:id=>load(path.resolve(path.dirname(file),id.endsWith('.json')?id:id+'.ts'))});return exports;}
const root='prototypes/punchies/src/sim/';const {createSimState,step,dodgeIFrames,stanceOf}=load(root+'sim.ts'),{tune,TICK_RATE}=load(root+'tune.ts'),{NEUTRAL_INPUT:N}=load(root+'types.ts'),{characterDodge}=load(root+'character.ts');
Object.assign(tune.ring,{left:0,top:0,right:3000,bottom:2000});
function pair(){const s=createSimState({timed:false,fighters:[{char:'marco'},{char:'marco',anchored:true}]});s.fighters[0].x=400;s.fighters[1].x=2000;s.fighters.forEach(f=>f.y=800);return s;}
const near=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const baseline=pair().fighters[0];near(characterDodge(baseline).speed,tune.dodge.speed);assert.equal(characterDodge(baseline).iFrames,tune.dodge.iFrames);
// Exercise the optional draft fields without requiring absent Kai artwork.
const c=tune.characters.marco;c.dodge={speedMult:1.15,iFramesMult:1.25,framesMult:1};c.hook.freeUses=6;
let s=pair(),f=s.fighters[0];const start=f.x,frames=characterDodge(f).frames;
for(let i=0;i<frames;i++)step(s,[i===0?{...N,dodge:true,mx:100}:N,N],false);
near(f.x-start,characterDodge(f).speed*frames/TICK_RATE);assert.equal(f.dodge,null);assert(f.postDodgeVulnerable>0);assert(f.dashBuff>0);
s=pair();f=s.fighters[0];f.exhausted=true;assert.equal(dodgeIFrames(f),Math.round(characterDodge(f).iFrames*tune.dodge.exhaustedEfficacy));f.dodge={frame:dodgeIFrames(f)-1,dx:1,dy:0};assert.equal(stanceOf(f),'dodging');f.dodge.frame++;assert.equal(stanceOf(f),'vulnerable');
s=pair();f=s.fighters[0];for(let i=1;i<=7;i++){f.punch=null;f.stamina=10000;const events=step(s,[{...N,hook:true},N],false);assert.equal(events.find(e=>e.kind==='throw')?.tired,i===7,`Hook ${i}`);if(i<=6)near(f.punch.damageMult,1);else assert(f.punch.damageMult<1);assert(f.stamina<10000,'every Hook spends stamina');}
delete c.dodge;delete c.hook.freeUses;
console.log('PASS optional character dodge distance/duration/iFrame boundary/exhausted scaling; six unpenalized Hooks, seventh fatigued, all spend stamina; shared defaults unchanged.');

