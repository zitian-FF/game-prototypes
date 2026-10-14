import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const sourceDir=fileURLToPath(new URL('../prototypes/punchies/art/dummy-portrait/',import.meta.url));
export const DUMMY_PORTRAIT_HASHES={
  standard:'8b0eb13c99f3577ea22a8dfe0371a47c7711cefb8c8b4233e3cbfb802f0da0ff',
  compact:'98f297cffd12d960179bf248ab3abf56392d9118d481cff7b4bb5bc6f39f748f',
};

// Portrait-only override: do not touch training_dummy_* parts or dummy atlases.
export function applyDummyPortrait(assetDir,profile='standard',entries=null){
  if(!(profile in DUMMY_PORTRAIT_HASHES))throw Error(`Unknown dummy portrait profile: ${profile}`);
  const bytes=fs.readFileSync(path.join(sourceDir,`portrait-${profile}.webp`));
  const hash=crypto.createHash('sha256').update(bytes).digest('hex');
  if(hash!==DUMMY_PORTRAIT_HASHES[profile])throw Error(`Canonical ${profile} dummy portrait hash mismatch`);
  const loose=path.join(assetDir,'loose');fs.mkdirSync(loose,{recursive:true});
  fs.rmSync(path.join(loose,'portrait_training_dummy.png'),{force:true});
  fs.writeFileSync(path.join(loose,'portrait_training_dummy.webp'),bytes);
  const file=path.join(assetDir,'manifest.json');
  const manifest=entries??JSON.parse(fs.readFileSync(file,'utf8'));
  for(let i=manifest.length-1;i>=0;i--)if(/^loose\/portrait_training_dummy\.(png|webp)$/.test(manifest[i].path))manifest.splice(i,1);
  manifest.push({path:'loose/portrait_training_dummy.webp',hash});
  if(!entries)fs.writeFileSync(file,JSON.stringify(manifest,null,2));
  return {key:'portrait_training_dummy',path:'loose/portrait_training_dummy.webp',hash,profile,bytes:bytes.length};
}
