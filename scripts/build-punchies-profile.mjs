// Separate staging roots prevent either profile from replacing the other's assets.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import AdmZip from 'adm-zip';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(root);
const args=process.argv.slice(2),value=key=>args[args.indexOf(key)+1];
const profile=args[0],portal=args.includes('--portal')?value('--portal'):profile==='compact'?'crazygames':'web';
if(!['standard','compact'].includes(profile)||!['web','crazygames','poki','playgama'].includes(portal))throw Error('Expected standard|compact and --portal web|crazygames|poki|playgama');
const settings=JSON.parse(fs.readFileSync('prototypes/punchies/asset-profiles.json'))[profile];
const staging=path.join(root,'.cache/punchies-profiles',profile),publicDir=path.join(staging,'public');
const target=path.join(publicDir,'prototypes/punchies');
fs.mkdirSync(staging,{recursive:true});
const run=(file,argv=[])=>execFileSync(process.execPath,[file,...argv],{stdio:'inherit'});
function reset(folder){if(!path.resolve(folder).startsWith(`${staging}${path.sep}`))throw Error('Staging path escaped profile root');fs.rmSync(folder,{recursive:true,force:true});}
async function archive(url,sha,destination,allowed){
  if(!/^[a-f0-9]{64}$/.test(sha))throw Error('Profile archive SHA-256 must be configured');
  const cache=path.join(staging,`${sha}.zip`);
  let bytes;
  if(fs.existsSync(cache)&&!args.includes('--fresh'))bytes=fs.readFileSync(cache);
  else{if(args.includes('--offline'))throw Error(`No verified cached archive: ${sha}`);const res=await fetch(url);if(!res.ok)throw Error(`HTTP ${res.status}: ${url}`);bytes=Buffer.from(await res.arrayBuffer());}
  if(crypto.createHash('sha256').update(bytes).digest('hex')!==sha)throw Error(`Checksum mismatch: ${url}`);
  const zip=new AdmZip(bytes);
  for(const entry of zip.getEntries())if(!allowed(entry.entryName))throw Error(`Unexpected archive path: ${entry.entryName}`);
  fs.writeFileSync(cache,bytes);
  fs.mkdirSync(destination,{recursive:true});zip.extractAllTo(destination,true);
}
// Clear only this named profile's disposable staging folder.
reset(publicDir);fs.mkdirSync(target,{recursive:true});
if(profile==='standard'){
  if(!args.includes('--offline'))run('scripts/fetch-assets.js',['punchies']);
  run('scripts/pack-assets.js',['punchies']);
  if(!args.includes('--offline'))run('scripts/fetch-punchies-music.mjs');
  const verifiedMusic=JSON.parse(fs.readFileSync('public/prototypes/punchies/audio/manifest.json'));
  if(verifiedMusic.bundleSha256!==JSON.parse(fs.readFileSync('prototypes/punchies/music-manifest.json')).sha256)throw Error('Standard audio cache is stale');
  for(const name of ['assets','audio']){
    const source=path.join(root,'public/prototypes/punchies',name);
    if(!fs.existsSync(source))throw Error(`Missing standard ${name}`);
    fs.cpSync(source,path.join(target,name),{recursive:true});
  }
}else{
  if(settings.standardMusicSha256!==JSON.parse(fs.readFileSync('prototypes/punchies/music-manifest.json')).sha256)throw Error('Standard music changed; regenerate the compact profile');
  if(!args.includes('--offline')){
    const source=await fetch('https://pub-415572b047994ab8807f76b8462eda45.r2.dev/punchies_assets.zip',{method:'HEAD'});
    if(!source.ok||source.headers.get('etag')!==settings.standardArtEtag)throw Error('Standard R2 art changed; regenerate the compact profile');
  }
  await archive(settings.artUrl,settings.artSha256,path.join(target,'assets'),name=>/^(loose|atlas)\/[A-Za-z0-9_.-]+$/.test(name)||['loose/','atlas/','manifest.json'].includes(name));
  reset(path.join(staging,'music'));
  await archive(settings.audioUrl,settings.audioSha256,staging,name=>/^music\/(title\.m4a|charselect\.m4a|gameplay\.m4a|credits\.md|SOURCE-MAPPING\.md)$/.test(name)||name==='music/');
  fs.cpSync(path.join(staging,'music'),path.join(target,'audio'),{recursive:true});
}
const profileRecord={profile,portal,musicExtension:settings.musicExtension,artSha256:settings.artSha256??null,audioSha256:settings.audioSha256??JSON.parse(fs.readFileSync('prototypes/punchies/music-manifest.json')).sha256};
fs.writeFileSync(path.join(target,'asset-profile.json'),JSON.stringify(profileRecord,null,2));
const outDir=path.join(root,'dist',`punchies-${profile}-${portal}`);
execFileSync(process.execPath,['node_modules/vite/bin/vite.js','build','--outDir',outDir,'--emptyOutDir','--base','./'],{stdio:'inherit',env:{...process.env,PUNCHIES_ASSET_PROFILE:profile,PUNCHIES_PUBLIC_DIR:publicDir,PORTAL:portal}});
execFileSync(process.execPath,['scripts/check-punchies-budget.mjs',outDir],{stdio:'inherit',env:{...process.env,PUNCHIES_BUDGET_LIMIT_BYTES:profile==='compact'?'10000000':'20000000',PUNCHIES_BUDGET_REPORT:path.join(staging,`budget-${portal}.json`)}});
console.log(`Built ${profile}/${portal}: ${outDir}`);
