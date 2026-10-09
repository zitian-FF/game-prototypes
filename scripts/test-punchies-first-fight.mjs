import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const config=JSON.parse(fs.readFileSync('prototypes/punchies/src/firstrun/firstfight.json'));
const exports={},saved={firstGiftDone:false};
let done=0,gifts=0,reveals=0,awards=0,resumes=0;
const modules={
  phaser:{default:{Scene:class{}}},
  '../i18n':{t:key=>key},
  '../firstrun/firstfight.json':{default:config},
  '../sim/tune':{TICK_RATE:60,tune:{}},
  '../sim/character':{maxHealth:()=>100},
  '../sim/types':{NEUTRAL_INPUT:{}},
  '../sim/sim':{step:()=>[]},
  '../portal/analytics':{track(){}},
  '../portal/gameplay':{setGameplay(){}},
  '../firstrun/state':{markFirstRunDone(){done++;}},
  '../progress/progress':{awardMatch(){awards++;return{};}},
  '../shop/draft':{loadShopDraft:()=>saved,saveShopDraft(){},grantFirstGift(){
    if(saved.firstGiftDone)return{state:saved};
    saved.firstGiftDone=true;gifts++;return{state:saved,item:{id:'skin-marco-unique'}};
  }},
  '../ui/rewardReveal':{RewardReveal:class{constructor(){reveals++;}}}
};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/scenes/FirstFightScene.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:key=>modules[key]??{}});
function scene(){
  const s=new exports.FirstFightScene();
  s.registry={set(){}};s.scene={resume(){resumes++;}};
  s.welcome=()=>{};
  s.built=true;s.coach={setText(){}};
  s.sim={fighters:[{x:0,y:0,health:100},{x:config.opponentJabRange,y:0,health:100}],result:null};
  s.stage={pollDevices(){},sampleLocal:()=>({jab:true,cross:true,hook:true,uppercut:true,dodge:true,guard:true,mx:45,my:-20}),handleEvents(){},draw(){}};
  return s;
}
const fight=scene();
const input=fight.playerInput();
assert.equal(input.jab,true);assert.equal(input.cross,true);assert.equal(input.mx,45);
for(const move of ['hook','uppercut','dodge','guard'])assert.equal(input[move],false);
fight.update(0,0);assert.equal(fight.phase,'jab','coach teaches jab upon reaching range before landing a hit');
for(let n=0;n<config.jabsStep;n++)fight.onHit('jab');assert.equal(fight.phase,'cross');
for(let n=0;n<config.crossesStep;n++)fight.onHit('cross');assert.equal(fight.phase,'mix');
assert.equal(fight.sim.fighters[1].health,100*(1-(config.jabsStep+config.crossesStep)/config.hitsToKo));
fight.finish('win');fight.finish('skip');
assert.equal(done,1);assert.equal(gifts,1);assert.equal(reveals,1);assert.equal(awards,1);
const replay=scene();replay.skipFromMenu();
assert.equal(resumes,1,'pause-menu return resumes the scene for reward presentation');
assert.equal(done,2);assert.equal(gifts,1,'a replay never duplicates the gift');assert.equal(reveals,1);assert.equal(awards,1,'skip gives no match XP');
saved.firstGiftDone=false;const skip=scene();skip.finish('skip');
assert.equal(gifts,2);assert.equal(reveals,2,'new players receive the same reveal when skipping');
console.log('PASS: first-fight allowed controls, coach sequence, even health drain, win/skip gift parity, replay idempotence and pause-menu return.');
