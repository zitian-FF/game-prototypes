import fs from 'node:fs';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundled=await build({entryPoints:['scripts/punchies-json-packing.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {packTuneMetadata,packLocale}=await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const load=async code=>(await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)).default;
const meta=JSON.parse(fs.readFileSync('prototypes/punchies/tune.meta.json'));
assert.deepEqual(await load(packTuneMetadata(meta)),meta,'every workshop label and validation range survives packing');
const en=JSON.parse(fs.readFileSync('prototypes/punchies/src/i18n/locales/en.json'));
for(const language of ['ja','ko','zh','es','ar']){
  const locale=JSON.parse(fs.readFileSync(`prototypes/punchies/src/i18n/locales/${language}.json`));
  const packed=packLocale(en,locale).replace("import en from './en.json';",`const en=${JSON.stringify(en)};`);
  assert.deepEqual(await load(packed),locale,`${language}: key order and every translated string are preserved`);
}
const partial={'menu.play':'Play'};
assert.deepEqual(await load(packLocale(en,partial)),partial,'missing keys retain the existing English fallback');
console.log('PASS: packed tune metadata and all five locale tables preserve exact runtime values');
