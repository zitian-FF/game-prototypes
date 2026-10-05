// Verify exported layer contract and atlas limits before uploading a ZIP.
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');const sharp=require('sharp');
(async()=>{
 const source='prototypes/punchies/assets-src/packed';const keys=fs.readdirSync(source);const bodies=keys.filter(k=>!/(?:_feet|_torso|_gloves|_head|_effects)$/.test(k));assert.equal(bodies.length,7);assert.equal(keys.length,532);let frames=0;
 for(const key of bodies){const bodyFiles=fs.readdirSync(path.join(source,key)).sort();const feetFiles=fs.readdirSync(path.join(source,key+'_feet')).sort();assert.deepEqual(feetFiles,bodyFiles,key+' registration/frame pairing');
  for(const file of bodyFiles)for(const layer of [key,key+'_feet']){const {data,info}=await sharp(path.join(source,layer,file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.deepEqual([info.width,info.height],[256,256]);assert(data.some((v,i)=>i%4===3&&v>0));assert.equal(data[3],0,'transparent canvas corner');if(layer.endsWith('_feet'))assert.equal(data[(128*256+128)*4+3],0,'feet layer contains no head/torso at anchor');frames++;}
 }
 const atlas='public/prototypes/punchies/assets/atlas';let sheets=0;for(const file of fs.readdirSync(atlas).filter(f=>f.endsWith('.png'))){const m=await sharp(path.join(atlas,file)).metadata();assert(m.width<=2048&&m.height<=2048,file);sheets++;}
 const logo=await sharp('prototypes/punchies/assets-src/loose/logo.png').raw().toBuffer({resolveWithObject:true});assert.equal(logo.info.channels,4);assert.equal(logo.data[3],0);assert(logo.data.some((v,i)=>i%4===3&&v===255));
 console.log(JSON.stringify({bodyFolders:bodies.length,feetFolders:105,componentFolders:420,frames,sheets,maxAtlas:2048,logoAlpha:true}));
})().catch(e=>{console.error(e);process.exit(1);});
