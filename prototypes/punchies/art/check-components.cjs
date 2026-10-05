const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),sharp=require('sharp'),Zip=require('adm-zip');
(async()=>{
 const root='prototypes/punchies/assets-src/packed',keys=fs.readdirSync(root),suffixes=['torso','gloves','head','effects'];
 const bodies=keys.filter(k=>!/(?:_feet|_torso|_gloves|_head|_effects)$/.test(k));assert.equal(bodies.length,105);assert.equal(keys.length,630);
 let frames=0,compared=0,preserved=0;
 if(process.env.LAYER_BASELINE){const zip=new Zip(process.env.LAYER_BASELINE);for(const entry of zip.getEntries().filter(e=>!e.isDirectory)){assert(fs.readFileSync(path.join('prototypes/punchies/assets-src',entry.entryName)).equals(entry.getData()),'legacy bytes changed: '+entry.entryName);preserved++;}}
 for(const key of bodies){const files=fs.readdirSync(path.join(root,key)).sort();for(const suffix of ['feet',...suffixes])assert.deepEqual(fs.readdirSync(path.join(root,key+'_'+suffix)).sort(),files,key+'_'+suffix);
  for(const file of files){const layers=await Promise.all([key,key+'_feet',...suffixes.map(s=>key+'_'+s)].map(async k=>{const r=await sharp(path.join(root,k,file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.deepEqual([r.info.width,r.info.height],[256,256]);assert.equal(r.data[3],0);frames++;return r.data;}));
   const result=Buffer.alloc(layers[0].length);for(const src of layers.slice(2))for(let n=0;n<src.length;n+=4){const a=src[n+3];if(!a)continue;if(a===255||!result[n+3]){src.copy(result,n,n,n+4);continue;}const sa=a/255,da=result[n+3]/255,oa=sa+da*(1-sa);for(let c=0;c<3;c++)result[n+c]=Math.round((src[n+c]*sa+result[n+c]*da*(1-sa))/oa);result[n+3]=Math.round(oa*255);}
   assert(result.equals(layers[0]),'composite mismatch '+key+'/'+file);compared++;
  }
 }
 const atlas='public/prototypes/punchies/assets/atlas',groups={};let sheets=0;for(const file of fs.readdirSync(atlas)){if(!/\.(png|json)$/.test(file))continue;const group=file.replace(/-\d+\.(png|json)$/,'').replace(/\.(png|json)$/,'');groups[group]=(groups[group]||0)+fs.statSync(path.join(atlas,file)).size;if(file.endsWith('.png')){const m=await sharp(path.join(atlas,file)).metadata();assert(m.width<=2048&&m.height<=2048,file);sheets++;}}
 console.log(JSON.stringify({bodyFolders:105,componentFolders:420,feetFolders:105,frames,pixelExactFrames:compared,preservedFiles:preserved,sheets,maxAtlas:2048,atlasBytes:groups},null,2));
})().catch(e=>{console.error(e);process.exit(1);});
