import assert from 'node:assert/strict';
import {build} from 'esbuild';
import cfg from '../prototypes/punchies/src/progress/progress-config.json' with {type:'json'};
const bundle=await build({stdin:{contents:`export * from './prototypes/punchies/src/ui/progressionModel';export * from './prototypes/punchies/src/progress/rules';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false});
const m=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const day=m.progressDay();
for(const [totalXp,xpToday,expected] of [[0,0,30],[360,0,30],[180,300,0],[Array.from({length:49},(_,i)=>m.xpForLevel(cfg,i+1)).reduce((a,b)=>a+b),0,0]]){
 const state={...m.newProgress(day),totalXp,xpToday,rewardedLevel:m.levelFromXp(cfg,totalXp)};const award=m.applyMatch(cfg,state,{kind:'vsai',win:true},day),snapshot=JSON.stringify(award),views=m.awardViews(award);
 assert.equal(award.xpGained,expected);assert.equal(views.before.level,m.levelFromXp(cfg,totalXp));assert.equal(views.after.level,m.levelFromXp(cfg,totalXp+expected));assert.equal(JSON.stringify(award),snapshot,'Presentation may not mutate saved award');
 for(const view of Object.values(views))assert(m.xpFraction(view)>=0&&m.xpFraction(view)<=1);
 if(totalXp===360){assert.equal(views.before.level,3);assert.equal(views.after.level,4);assert.deepEqual(award.levelUps[0].rewards,[{kind:'title',id:'scrapper'}]);}
}
assert.equal(m.xpFraction({xp:0,xpToNext:0,maxed:true}),1);
for(const [width,height] of [[844,390],[693,390],[844,532],[1033,390]]){const p=m.profileLayout(width,height);assert(p.w<=width-32&&p.cardW>120&&p.cardH>80);assert.equal(p.left+p.gap+p.right,p.w);assert(p.h+116===height);}
console.log('PASS: result XP before/after, level crossing, daily cap, max level, immutable awards and responsive reward layout');
