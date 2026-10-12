import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {build} from 'esbuild';
const base='prototypes/punchies/src/';
function module(file,mocks={},globals={}) {
 const exports={}; vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,URLSearchParams,...globals,require:id=>mocks[id]??{}}); return exports;
}
const gateModule=module('scripts/punchies-debug-gate.ts');
for(const staging of [false,true]) for(const qa of [false,true]) {
 const gate=gateModule.punchiesDebugGate(staging,qa);
 const importer=process.cwd().replaceAll('\\','/')+'/'+base+'boot.ts';
 const resolved=gate.resolveId('./debug/debugPanel',importer);
 assert.equal(!!resolved,!(staging&&qa));
 const flags=module(base+'buildFlags.ts',{}, {__PUNCHIES_STAGING__:staging,__PUNCHIES_QA__:qa});
 let reads=0,writes=0; const data=new Map([['unlock','1'],['debug','1']]);
 const panel=module(base+'debug/debugPanel.ts',{'../buildFlags':flags,'../portal/keys':{DEV_KEYS:{debug:'debug',unlock:'unlock'}}},{location:{search:'?debug=1'},localStorage:{getItem:k=>{reads++;return data.get(k);},setItem:(k,v)=>{writes++;data.set(k,v);},removeItem:k=>{writes++;data.delete(k);}}});
 assert.equal(panel.isDebug(),staging&&qa);assert.equal(panel.debugUnlocked(),staging&&qa);
 if(!(staging&&qa)){assert.equal(reads+writes,0);panel.mountDebugPanelIfRequested();}
 if(resolved){
 const result=await build({stdin:{contents:"export {isDebug,debugUnlocked,mountDebugPanelIfRequested} from './debug/debugPanel';",resolveDir:process.cwd()+'/'+base,sourcefile:importer},bundle:true,write:false,metafile:true,format:'esm',plugins:[{name:'actual-vite-gate',setup(b){b.onResolve({filter:/debugPanel/},args=>{const path=gate.resolveId(args.path,args.importer);return path?{path}:undefined;});}}]});
 const graph=Object.keys(result.metafile.inputs).join('\n');assert(!graph.includes('debugPanel.ts'));assert(!graph.includes('tweakpane'));const code=result.outputFiles[0].text;assert(!/localStorage|URLSearchParams|mountPanel|punchies tune/.test(code));
 }
}
const consumers=fs.readFileSync(base+'boot.ts','utf8');assert(consumers.includes("'./debug/debugPanel'"));
assert(fs.readFileSync('vite.config.ts','utf8').includes('punchiesDebugGate(stagingBuild, qaBuild)'));
console.log('PASS all staging/QA combinations; production module graph excludes real panel/Tweakpane/query/storage; no browser unlock reads/writes; staging QA retains opt-in.');

