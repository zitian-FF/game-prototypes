import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const root=process.cwd(),dest=path.resolve(process.argv[2]??'dist-staging');
const run=(args,env={})=>execFileSync(process.execPath,args,{stdio:'inherit',env:{...process.env,...env}});
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const sha=git('rev-parse','HEAD'),branch=git('branch','--show-current'),builtAt=new Date().toISOString();
// Prove that the normal entry does not emit the optional QA module or route.
run(['scripts/build-punchies-profile.mjs','compact','--portal','web','--fresh'],{PUNCHIES_STAGING_QA:'0',VITE_PUNCHIES_RATING_URL:''});
const source=path.resolve('dist/punchies-compact-web');
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const excluded=files(source).every(f=>!f.includes('staging-review')&&(!f.endsWith('.js')||!fs.readFileSync(f,'utf8').includes('PUNCHIES_STAGE_QA_ONLY')));
if(!excluded)throw Error('QA leaked into the production artifact');
const productionFiles=files(source).length;
run(['scripts/build-punchies-profile.mjs','compact','--portal','web'],{PUNCHIES_STAGING_QA:'1',VITE_PUNCHIES_RATING_URL:''});
if(!fs.existsSync(path.join(source,'staging-review.html')))throw Error('Missing opted-in QA route');
const output=path.join(dest,'builds',sha,'game');fs.mkdirSync(output,{recursive:true});fs.cpSync(source,output,{recursive:true});
const emitted=files(output),bytes=emitted.reduce((sum,f)=>sum+fs.statSync(f).size,0),largest=Math.max(...emitted.map(f=>fs.statSync(f).size));
if(emitted.filter(f=>f.endsWith('.js')).some(f=>fs.readFileSync(f,'utf8').includes('punchies-rating.tianz-88.workers.dev')))throw Error('Production rating endpoint leaked into staging');
const metadata={sha,branch,builtAt,quality:'compact',portal:'web',bytes,files:emitted.length,largestFileBytes:largest,ratedPlay:'disabled; no rating endpoint compiled',productionQaExclusion:{passed:excluded,fileCount:productionFiles},artProfile:JSON.parse(fs.readFileSync(path.join(output,'prototypes/punchies/asset-profile.json')))};
fs.writeFileSync(path.join(dest,'stage.json'),JSON.stringify(metadata,null,2));
const game=`builds/${sha}/game/index.html`,qa=`builds/${sha}/game/staging-review.html`;
fs.writeFileSync(path.join(dest,'index.html'),`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Punchies staging</title><style>body{margin:0;background:#071020;color:#edf2ff;font:15px system-ui}header{padding:18px;max-width:1000px;margin:auto}a{color:#7ce2e5}code{overflow-wrap:anywhere}iframe{display:block;width:100%;height:calc(100vh - 170px);min-height:360px;border:0}small{display:block;color:#adc3da;margin:8px 0}</style></head><body><header><b>STAGING · Punchies SUPER preview · COMPACT / web</b><small>Branch <code>${branch}</code> · SHA <code>${sha}</code><br>Built ${builtAt} · ${(bytes/1e6).toFixed(2)} MB</small><a href="${game}" target="_blank">Open game fullscreen</a> · <a href="${qa}" target="_blank">Optional effect review (controlled fixture)</a> · <a href="./?refresh=${sha}">Refresh latest stage</a><small>Rated play disabled. Local/AI play available. Optional QA injects controlled contacts; the default game does not. Live itch remains r0150.</small></header><iframe title="Staged Punchies game" src="${game}?stage=${sha}" allow="autoplay; fullscreen" allowfullscreen></iframe></body></html>`);
console.log(JSON.stringify(metadata,null,2));
