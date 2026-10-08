// Separate from art: verified against the approved bundle's content hash.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'prototypes/punchies/music-manifest.json'),'utf8'));
const response=await fetch(manifest.url);
if(!response.ok)throw new Error(`Music download failed: HTTP ${response.status}`);
const bytes=Buffer.from(await response.arrayBuffer());
if(crypto.createHash('sha256').update(bytes).digest('hex')!==manifest.sha256)throw new Error('Music bundle checksum mismatch');
const zip=new AdmZip(bytes),target=path.join(root,'public/prototypes/punchies/audio');
// Validate every required file before writing. Never extract arbitrary zip paths.
const names=[...manifest.tracks.map(track=>`${track}.mp3`),'credits.md','SOURCE-MAPPING.md'];
const files=names.map(name=>{const entry=zip.getEntry(`music/${name}`);if(!entry||entry.isDirectory)throw new Error(`Music bundle missing ${name}`);return [name,entry.getData()];});
fs.mkdirSync(target,{recursive:true});
for(const [name,data] of files)fs.writeFileSync(path.join(target,name),data);
fs.writeFileSync(path.join(target,'manifest.json'),JSON.stringify({bundleSha256:manifest.sha256,files:files.map(([name,data])=>({name,sha256:crypto.createHash('sha256').update(data).digest('hex')}))},null,2));
console.log('Fetched and verified three Punchies music tracks and provenance.');
