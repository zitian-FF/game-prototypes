// Conservative package budget: include every shared JS/CSS file shipped by WIP
// plus all Punchies files, including dynamically loaded audio/art and provenance.
import fs from 'node:fs';
import path from 'node:path';
const root=process.argv[2]??'dist';
const files=[];
for(const folder of ['assets','prototypes/punchies']){
  const dir=path.join(root,folder);
  if(!fs.existsSync(dir))throw new Error(`Missing build folder: ${dir}`);
  for(const file of fs.readdirSync(dir,{recursive:true})){
    const full=path.join(dir,file);
    if(fs.statSync(full).isFile())files.push({path:`${folder}/${file.replaceAll('\\','/')}`,bytes:fs.statSync(full).size});
  }
}
const categories={art:0,audio:0,codeAndOther:0};
for(const file of files){const key=/\.(mp3|ogg|wav|m4a)$/.test(file.path)||file.path.includes('/audio/')?'audio':file.path.includes('/assets/')||/\.(png|webp|jpg)$/.test(file.path)?'art':'codeAndOther';categories[key]+=file.bytes;}
const total=files.reduce((sum,file)=>sum+file.bytes,0);
const report={limitBytes:20_000_000,totalBytes:total,categories,fileCount:files.length,largest:files.sort((a,b)=>b.bytes-a.bytes).slice(0,15)};
console.log(JSON.stringify(report,null,2));
if(process.env.PUNCHIES_BUDGET_REPORT)fs.writeFileSync(process.env.PUNCHIES_BUDGET_REPORT,JSON.stringify(report,null,2));
if(total>report.limitBytes||files.length>1500)throw new Error('Punchies exceeds conservative 20 MB / 1500 file budget');
for(const f of files.filter(f=>/\/portrait_[^/]+\.(webp|png)$/.test(f.path)))if(f.bytes>=1_000_000)throw new Error(`Portrait exceeds 1 MB: ${f.path}`);
