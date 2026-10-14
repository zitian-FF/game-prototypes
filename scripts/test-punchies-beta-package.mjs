import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import AdmZip from 'adm-zip';
const folder=process.argv[2],base=path.join(folder,'prototypes/punchies'),record=JSON.parse(fs.readFileSync(path.join(base,'asset-profile.json'))),manifest=JSON.parse(fs.readFileSync(path.join(base,'assets/manifest.json')));
const fighters=['marco','mia','bruno','roxy','nadia'],excluded=['tee','tyke','dragon','longan','captain','kai'];
assert.equal(record.edition,'itchbeta');assert.equal(record.portal,'web');assert.equal(record.staging,false);assert.equal(record.editionArt.skins,'default');assert.deepEqual(record.editionFighters,fighters);assert(!record.approvedContent&&!record.stageArtOverlay);
const sourceSettings=JSON.parse(fs.readFileSync('prototypes/punchies/asset-profiles.json'));
const zip=new AdmZip('.cache/punchies-profiles/compact/'+sourceSettings.compact.artSha256+'.zip');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(dir,entry.name)):[path.join(dir,entry.name)]),files=walk(folder);
assert.equal(files.filter(file=>file.endsWith('.html')).length,1);assert(fs.existsSync(path.join(folder,'index.html')));assert(!files.some(file=>/staging-review|ranked-review|beta-ui-review/.test(file)));
for(const entry of manifest){const bytes=fs.readFileSync(path.join(base,'assets',entry.path));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),entry.hash);if(!['loose/part-mirrors.json'].includes(entry.path)){const original=zip.getEntry(entry.path);assert(original,'retained asset comes from verified MASTER archive');assert.deepEqual(bytes,original.getData(),'no recompression/resizing of retained asset');}
 assert(!excluded.some(id=>new RegExp(`/(?:portrait|part|materialmask)_${id}(?:_|\\.)`).test(entry.path)));assert(!/marco_(mcclassic|rising_star)|mia_flaming_kunoichi|chest_|punch_token|reward_ad|kai_emblems|part_zombie/.test(entry.path));}
for(const fighter of fighters)assert(manifest.some(entry=>entry.path==='loose/portrait_'+fighter+'.webp'));
const aliases=JSON.parse(fs.readFileSync(path.join(base,'assets/loose/part-mirrors.json')));
for(const fighter of fighters)for(const part of ['head','torso','glove_left','glove_right','boot_left','boot_right'])assert(aliases[`part_${fighter}_${part}`]||fs.existsSync(path.join(base,'assets/loose',`part_${fighter}_${part}.webp`)));
for(const alias of Object.values(aliases))assert(fs.existsSync(path.join(base,'assets/loose',alias.source+'.webp')));
const code=files.filter(file=>file.endsWith('.js')).map(file=>fs.readFileSync(file,'utf8')).join('\n');
for(const marker of ['PUNCHIES_STAGE_QA_ONLY','PUNCHIES_RANKED_FICTIONAL_QA_ONLY','Reset staging test saves','SYNC TUNE','tp-dfwv','sdk.crazygames.com','sdk.poki.com','bridge.playgama.com','skinChestEvery','fighterChestEvery','fighter-kai'])assert(!code.includes(marker),'forbidden shipped Beta marker: '+marker);
assert(record.editionArt.removedFiles>0);assert.equal(record.audioSha256,sourceSettings.compact.audioSha256);
console.log('PASS actual Beta package:5 default rigs/portraits, no excluded fighters/alts/economy art/config/SDK/QA, retained MASTER bytes/mirrors unchanged and audio reused');
