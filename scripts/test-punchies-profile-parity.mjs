import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const [standard,compact]=process.argv.slice(2);
const art=folder=>path.join(folder,'prototypes/punchies/assets');
const a=art(standard),b=art(compact);
const keys=folder=>JSON.parse(fs.readFileSync(path.join(folder,'manifest.json'))).map(f=>f.path).sort();
assert.deepEqual(keys(a),keys(b),'same reachable texture and animation keys');
for(const file of keys(a).filter(file=>file.endsWith('.json')&&file!=='manifest.json'||file.startsWith('loose/part_'))){
  assert(fs.readFileSync(path.join(a,file)).equals(fs.readFileSync(path.join(b,file))),`registration, palette source and aliases retained: ${file}`);
}
console.log('PASS: profiles share identical keys, atlas geometry, mirror aliases and fighter part pixels');
