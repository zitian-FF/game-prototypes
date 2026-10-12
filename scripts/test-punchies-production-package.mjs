import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
const root=process.argv[2];const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(dir,entry.name)):[path.join(dir,entry.name)]);
const files=walk(root),profile=JSON.parse(fs.readFileSync(path.join(root,'prototypes/punchies/asset-profile.json')));
assert.equal(profile.staging,false);assert.equal(profile.saveResetId,'punchies-reset-2026-10-12-super-v1');assert(!profile.stageArtOverlay);
assert.equal(files.filter(file=>file.endsWith('.html')).length,1);
assert(!files.some(file=>/staging-review|ranked-review|materialmask_tee|part_kai_|portrait_kai|kai_emblems/.test(file)));
const code=files.filter(file=>file.endsWith('.js')).map(file=>fs.readFileSync(file,'utf8')).join('\n');
for(const marker of ['PUNCHIES_STAGE_QA_ONLY','PUNCHIES_RANKED_STAGE_QA_ONLY','PUNCHIES_RANKED_FICTIONAL_QA_ONLY','Reset staging test saves','Preview in Training (no unlocks)','punchies tune','SYNC TUNE','tp-dfwv'])assert(!code.includes(marker),`Production leaks ${marker}`);
console.log('PASS production flags/reset, QA/currency-control module exclusion, one root HTML, no experimental mask');
