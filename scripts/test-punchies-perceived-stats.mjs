import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const bundle=await build({stdin:{contents:`export * from './prototypes/punchies-tuner/src/model';export * from './prototypes/punchies/src/sim/perceivedStats';export {punchCfg} from './prototypes/punchies/src/sim/character';export {applyTuneJson,snapshotTune,restoreTune} from './prototypes/punchies/src/sim/tune';export {t,setLanguage,setLocaleLoader} from './prototypes/punchies/src/i18n';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false});
const m=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const base=m.defaults(),types=['jab','cross','hook','uppercut'];
for(const ratio of Object.values(m.perceivedStats(base,'base')))assert.equal(m.statBarFill(ratio),.8);
for(const id of m.characters){
  m.applyTuneJson(JSON.stringify(base));const c=base.characters[id],stats=m.perceivedStats(base,id);
  const baseFrames=types.reduce((sum,type)=>sum+base.punches[type].startup+base.punches[type].recovery,0);
  const frames=types.reduce((sum,type)=>sum+Math.max(1,base.punches[type].startup+c[type].startup)+Math.max(1,base.punches[type].recovery+c[type].recovery),0);
  const reach=types.reduce((sum,type)=>sum+m.punchCfg(id,type).reach/(base.punches[type].reach*base.view.fighterScale),0)/4;
  assert.equal(stats.health,c.hp);assert.equal(stats.endurance,(c.stamina+c.stun)/2);assert.equal(stats.speed,(c.speed+baseFrames/frames)/2);
  assert.equal(stats.power,types.reduce((sum,type)=>sum+c[type].damage,0)/4);assert(Math.abs(stats.reach-reach)<1e-12,'Matches old game reach including body proportions');
}
assert.equal(m.statBarFill(2),1);assert.equal(m.statBarFill(-1),0);
const tune=m.defaults();m.set(tune,'characters.mia.hp',1.1);assert(Math.abs(m.statBarFill(m.perceivedStats(tune,'mia').health)-.88)<1e-12);
m.set(tune,'punches.jab.startup',2);assert.notEqual(m.perceivedStats(tune,'mia').speed,m.perceivedStats(base,'mia').speed,'Base frames affect relative hand speed');
const sized=m.defaults();m.set(sized,'body.proportions.mia',1.1);
assert(Math.abs(m.perceivedStats(sized,'mia').reach-m.perceivedStats(base,'mia').reach*1.1/.88)<1e-12,'Draft size changes preview without mutating live tune');
assert(Math.abs(m.effective(sized,'mia','jab','reach')-sized.punches.jab.reach*sized.characters.mia.jab.reach*sized.view.fighterScale*1.1)<1e-12);
assert(Math.abs(m.effective(sized,'mia','defense','hurtRadius')-sized.body.hurtRadius*sized.view.fighterScale*1.1)<1e-12);
assert.equal(m.effective(sized,'mia','defense','proportion'),1.1);
const sizedSave=m.mergeSave(base,sized,base);assert.equal(m.baseVersion(sizedSave),1);assert.equal(sizedSave.balanceWorkshop.baseHistory.versions[0].changes[0].path,'body.proportions.mia');
const scaled=m.defaults();m.set(scaled,'view.fighterScale',1.4);assert.equal(m.baseVersion(m.mergeSave(base,scaled,base)),1);
for(const id of ['tyke','dragon','longan']){const d=m.defaults();m.setArchetype(d,`char.${id}.nick`,'New Style');assert.equal(m.archetypeValue(m.mergeSave(base,d,base),`char.${id}.nick`),'New Style');}
const draft=m.defaults();m.setArchetype(draft,'char.mia.nick','Counter Specialist');
const saved=m.mergeSave(base,draft,base);assert.equal(m.archetypeValue(saved,'char.mia.nick'),'Counter Specialist');assert.equal(m.baseVersion(saved),0);
assert.deepEqual(m.saveChanges(base,saved),['char.mia.nick']);assert.equal(m.archetypeValue(m.parse(JSON.stringify(saved)),'char.mia.nick'),'Counter Specialist');
const concurrent=m.defaults();m.setArchetype(concurrent,'char.bruno.nick','Heavy Hitter');assert.equal(m.archetypeValue(m.mergeSave(base,draft,concurrent),'char.bruno.nick'),'Heavy Hitter');
m.setArchetype(concurrent,'char.mia.nick','Brawler');assert.throws(()=>m.mergeSave(base,draft,concurrent),/same fields/);
assert.throws(()=>m.setArchetype(draft,'secret.key','Bad'));assert.throws(()=>m.setArchetype(draft,'char.mia.nick',''));assert.throws(()=>m.setArchetype(draft,'char.mia.nick','x'.repeat(81)));
m.applyTuneJson(JSON.stringify(saved));assert.equal(m.t('char.mia.nick'),'Counter Specialist');const snapshot=m.snapshotTune();
m.applyTuneJson(JSON.stringify(base));assert.equal(m.t('char.mia.nick'),'Agile');m.restoreTune(snapshot);assert.equal(m.t('char.mia.nick'),'Counter Specialist');
m.setLocaleLoader(async()=>({'char.mia.nick':'カウンター型'}),{ja:1});await m.setLanguage('ja');assert.equal(m.t('char.mia.nick'),'カウンター型');
await m.setLanguage('pseudo');assert.equal(m.t('char.mia.nick'),'⟦Counter Specialist⟧');await m.setLanguage('en');
const dir=await mkdtemp(path.join(tmpdir(),'punchies-archetype-'));
try{const file=path.join(dir,'tune.json'),csv=path.join(dir,'strings.csv');const exportDoc=structuredClone(saved);m.setArchetype(exportDoc,'char.longan.nick','Tuned Longan');await writeFile(file,JSON.stringify(exportDoc));execFileSync(process.execPath,['scripts/i18n-sheet.mjs','export',csv],{env:{...process.env,I18N_TUNE:file}});assert((await readFile(csv,'utf8')).includes('char.mia.nick,Counter Specialist,'),'Export uses tuned archetype under its localisation key');assert((await readFile(csv,'utf8')).includes('char.longan.nick,Tuned Longan,'),'New roster archetypes export');}finally{assert(path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep));await rm(dir,{recursive:true,force:true});}
console.log('PASS: Base 80% benchmark, parity with all game display formulas, live tuning, caps, text-only saves, conflicts, localisation/sync/snapshot and sheet export');
