import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const bundle=await build({stdin:{contents:`export * from './prototypes/punchies-tuner/src/model';export * from './prototypes/punchies/src/sim/perceivedStats';export {rosterScores,statFill} from './prototypes/punchies/src/sim/rosterStats';export {punchCfg} from './prototypes/punchies/src/sim/character';export {applyTuneJson,snapshotTune,restoreTune} from './prototypes/punchies/src/sim/tune';export {t,setLanguage,setLocaleLoader} from './prototypes/punchies/src/i18n';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false});
const m=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const base=m.defaults();delete base.balanceWorkshop?.baseHistory;
for(const stat of m.perceivedStatKeys)assert.equal(m.statBarFill(m.perceivedStats(base,'base')[stat],stat),.6);
for(const id of m.characters){m.applyTuneJson(JSON.stringify(base));const expected=m.rosterScores(id),actual=m.perceivedStats(base,id);for(const stat of m.perceivedStatKeys)assert(Math.abs(actual[stat]-expected[stat])<1e-12,id+'.'+stat);}
assert.equal(m.statBarFill(2),1);assert.equal(m.statBarFill(-1),0);
const tune=m.defaults();m.set(tune,'characters.mia.hp',1.1);assert(m.perceivedStats(tune,'mia').durability>m.perceivedStats(base,'mia').durability);
m.set(tune,'punches.jab.startup',2);assert.notEqual(m.perceivedStats(tune,'mia').speed,m.perceivedStats(base,'mia').speed,'Base frames affect relative hand speed');
const sized=structuredClone(base);m.set(sized,'body.proportions.mia',1.1);
assert(Math.abs(m.perceivedStats(sized,'mia').reach-m.perceivedStats(base,'mia').reach*1.1/base.body.proportions.mia)<1e-12,'Draft size changes preview without mutating live tune');
assert(Math.abs(m.effective(sized,'mia','jab','reach')-sized.punches.jab.reach*sized.characters.mia.jab.reach*sized.view.fighterScale*1.1)<1e-12);
assert(Math.abs(m.effective(sized,'mia','defense','hurtRadius')-sized.body.hurtRadius*sized.view.fighterScale*1.1)<1e-12);
assert.equal(m.effective(sized,'mia','defense','proportion'),1.1);
const sizedSave=m.mergeSave(base,sized,base);assert.equal(m.baseVersion(sizedSave),0,'Individual size edits do not version Base');assert.equal(sizedSave.body.proportions.mia,1.1);
const legacy=m.defaults();legacy.balanceWorkshop={baseHistory:{format:1,initial:{'body.proportions.mia':.88},versions:[{version:1,savedAt:'2026-10-10T00:00:00Z',changes:[{path:'body.proportions.mia',before:.88,after:1.1}]}]}};assert.equal(m.baseVersion(m.parse(JSON.stringify(legacy))),1,'Previous logs remain readable');
const scaled=structuredClone(base);m.set(scaled,'view.fighterScale',1.4);assert.equal(m.baseVersion(m.mergeSave(base,scaled,base)),1);
for(const id of ['tyke','dragon','longan']){const d=structuredClone(base);m.setArchetype(d,`char.${id}.nick`,'New Style');assert.equal(m.archetypeValue(m.mergeSave(base,d,base),`char.${id}.nick`),'New Style');}
const draft=structuredClone(base);m.setArchetype(draft,'char.mia.nick','Counter Specialist');
const saved=m.mergeSave(base,draft,base);assert.equal(m.archetypeValue(saved,'char.mia.nick'),'Counter Specialist');assert.equal(m.baseVersion(saved),0);
assert.deepEqual(m.saveChanges(base,saved),['char.mia.nick']);assert.equal(m.archetypeValue(m.parse(JSON.stringify(saved)),'char.mia.nick'),'Counter Specialist');
const concurrent=m.defaults();m.setArchetype(concurrent,'char.bruno.nick','Heavy Hitter');assert.equal(m.archetypeValue(m.mergeSave(base,draft,concurrent),'char.bruno.nick'),'Heavy Hitter');
m.setArchetype(concurrent,'char.mia.nick','Brawler');assert.throws(()=>m.mergeSave(base,draft,concurrent),/same fields/);
assert.throws(()=>m.setArchetype(draft,'secret.key','Bad'));assert.throws(()=>m.setArchetype(draft,'char.mia.nick',''));assert.throws(()=>m.setArchetype(draft,'char.mia.nick','x'.repeat(81)));
m.applyTuneJson(JSON.stringify(saved));assert.equal(m.t('char.mia.nick'),'Counter Specialist');const snapshot=m.snapshotTune();
m.applyTuneJson(JSON.stringify(base));assert.equal(m.t('char.mia.nick'),m.archetypeValue(base,'char.mia.nick'));m.restoreTune(snapshot);assert.equal(m.t('char.mia.nick'),'Counter Specialist');
m.setLocaleLoader(async()=>({'char.mia.nick':'カウンター型'}),{ja:1});await m.setLanguage('ja');assert.equal(m.t('char.mia.nick'),'カウンター型');
await m.setLanguage('pseudo');assert.equal(m.t('char.mia.nick'),'⟦Counter Specialist⟧');await m.setLanguage('en');
const dir=await mkdtemp(path.join(tmpdir(),'punchies-archetype-'));
try{const file=path.join(dir,'tune.json'),csv=path.join(dir,'strings.csv');const exportDoc=structuredClone(saved);m.setArchetype(exportDoc,'char.longan.nick','Tuned Longan');await writeFile(file,JSON.stringify(exportDoc));execFileSync(process.execPath,['scripts/i18n-sheet.mjs','export',csv],{env:{...process.env,I18N_TUNE:file}});assert((await readFile(csv,'utf8')).includes('char.mia.nick,Counter Specialist,'),'Export uses tuned archetype under its localisation key');assert((await readFile(csv,'utf8')).includes('char.longan.nick,Tuned Longan,'),'New roster archetypes export');}finally{assert(path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep));await rm(dir,{recursive:true,force:true});}
console.log('PASS: Base 60% benchmark, parity with all game display formulas, live tuning, caps, text-only saves, conflicts, localisation/sync/snapshot and sheet export');
