// Offline conversion, retaining the approved tracks, stereo, sample rate and duration.
// node scripts/optimize-punchies-audio.mjs original.zip output-dir /path/to/ffmpeg
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import AdmZip from 'adm-zip';
const [input,out,ffmpeg='ffmpeg']=process.argv.slice(2);
if(!input||!out)throw Error('Expected original audio ZIP and output directory');
fs.mkdirSync(out,{recursive:true});
const original=new AdmZip(input),active=new AdmZip(),files=[];
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const ffprobe=path.join(path.dirname(ffmpeg),process.platform==='win32'?'ffprobe.exe':'ffprobe');
const inspect=file=>JSON.parse(execFileSync(ffprobe,['-v','error','-show_entries','format=duration:stream=sample_rate,channels','-of','json',file],{encoding:'utf8'}));
for(const entry of original.getEntries().filter(e=>!e.isDirectory)){
  const source=entry.getData(),name=path.posix.basename(entry.entryName);
  let bytes=source,metadata;
  if(name.endsWith('.mp3')){
    if(!['title.mp3','charselect.mp3','gameplay.mp3'].includes(name))throw Error(`Unexpected music file ${name}`);
    const before=path.join(out,`original-${name}`),after=path.join(out,name);
    fs.writeFileSync(before,source);
    execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-y','-i',before,'-map_metadata','-1','-codec:a','libmp3lame','-b:a','128k','-ar','44100','-ac','2',after]);
    const a=inspect(before),b=inspect(after);
    if(Math.abs(Number(a.format.duration)-Number(b.format.duration))>.1||b.streams[0].channels!==a.streams[0].channels||b.streams[0].sample_rate!==a.streams[0].sample_rate)throw Error(`Audio contract changed: ${name}`);
    metadata={before:a,after:b};bytes=fs.readFileSync(after);
  }
  active.addFile(entry.entryName,bytes);
  files.push({path:entry.entryName,originalBytes:source.length,originalSha256:hash(source),activeBytes:bytes.length,activeSha256:hash(bytes),reason:metadata?'128 kbps MP3; full stereo track and duration retained':'Provenance retained byte-for-byte',metadata});
}
for(const entry of active.getEntries())entry.header.time=new Date(2000,0,1);
const bytes=active.toBuffer(),report={originalSha256:hash(fs.readFileSync(input)),activeSha256:hash(bytes),originalBytes:fs.statSync(input).size,activeBytes:bytes.length,files};
fs.writeFileSync(path.join(out,'punchies-audio-active.zip'),bytes);
fs.writeFileSync(path.join(out,'audio-cleanup-manifest.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({bytes:bytes.length,sha256:report.activeSha256}));
