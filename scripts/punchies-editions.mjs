import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const EDITIONS=JSON.parse(fs.readFileSync(path.join(root,'prototypes/punchies/editions.json'),'utf8'));
export function editionContract(name=EDITIONS.defaultEdition,{allowPreparation=false}={}) {
  if(!Object.hasOwn(EDITIONS.editions,name))throw Error(`Unknown Punchies edition: ${name}`);
  const edition=structuredClone(EDITIONS.editions[name]);
  const master=new Set(EDITIONS.masterFighters);
  if(!edition.fighters.length||new Set(edition.fighters).size!==edition.fighters.length||edition.fighters.some(id=>!master.has(id)))throw Error(`Invalid edition roster: ${name}`);
  if(edition.rows&&JSON.stringify(edition.rows.flat())!==JSON.stringify(edition.fighters))throw Error(`Grid and roster differ: ${name}`);
  if(name==='itchbeta'&&(edition.ads||edition.economy||edition.progression||edition.skins!=='default'))throw Error('Beta contains forbidden monetization or skins');
  if(!allowPreparation&&!edition.runtimeReady)throw Error(`Edition ${name} is preparation only: runtime/UI/inbound-policy gates are not complete`);
  const policy={name,fighters:edition.fighters,skins:edition.skins,initialFighters:edition.initialFighters??edition.fighters,milestones:edition.milestones??[],onlineCohort:edition.onlineCohort};
  return {...edition,name,policyHash:crypto.createHash('sha256').update(JSON.stringify(policy)).digest('hex')};
}
// Output and archive identities must distinguish edition, quality and portal.
// Never prune or mutate the MASTER tune in place.
export function editionTune(source,name) {
  const contract=editionContract(name,{allowPreparation:true});
  const result=structuredClone(source);
  result.characters=Object.fromEntries(contract.fighters.map(id=>{
    if(!Object.hasOwn(source.characters,id))throw Error(`Missing MASTER tune: ${id}`);
    return [id,structuredClone(source.characters[id])];
  }));
  delete result.balanceWorkshop;
  return result;
}
export function editionBuildIdentity(name,profile,portal) {
  editionContract(name,{allowPreparation:true});
  if(!['standard','compact'].includes(profile)||!['web','crazygames','poki','playgama'].includes(portal))throw Error('Invalid quality/portal');
  if(name==='crazygames'&&portal!=='crazygames'||name==='itchbeta'&&portal!=='web')throw Error('Edition and portal do not match');
  return `${name}-${profile}-${portal}`;
}

// Select delivery files and embedded indexes before Vite copies public assets.
// Prepared file bytes and atlas registration remain unchanged.
export function selectEditionArt(directory,name) {
  const edition=editionContract(name,{allowPreparation:true});
  const manifestPath=path.join(directory,'manifest.json');
  const source=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  const sourceHash=crypto.createHash('sha256').update(JSON.stringify(source)).digest('hex');
  const read=relative=>JSON.parse(fs.readFileSync(path.join(directory,relative),'utf8'));
  const groups=read('atlas/groups.json'),animations=read('atlas/animations.json');
  const owner=key=>EDITIONS.masterFighters.find(id=>key===id||key.startsWith(id+'_'));
  const keepKey=key=>{const fighter=owner(key);return !fighter||edition.fighters.includes(fighter)&&(edition.skins!=='default'||key===fighter);};
  const allowedGroups=Object.fromEntries(Object.entries(groups).filter(([key])=>keepKey(key)));
  const atlasFiles=new Set(Object.values(allowedGroups).flatMap(group=>group.atlases));
  const animationKeys=new Set(Object.values(allowedGroups).flatMap(group=>group.animations));
  const allowedAnimations=Object.fromEntries(Object.entries(animations).filter(([key])=>animationKeys.has(key)));
  const keep=relative=>{
    if(name==='itchbeta'&&/^loose\/(chest_|punch_token|reward_ad|kai_emblems|part_zombie)/.test(relative))return false;
    if(relative.startsWith('atlas/atlas-'))return atlasFiles.has(relative)||[...atlasFiles].some(json=>json.replace(/\.json$/,'.webp')===relative);
    const key=path.basename(relative).replace(/\.(webp|png|json)$/,'').replace(/^(part|portrait|materialmask)_/,'');
    const fighter=owner(key);
    if(!fighter)return true;
    if(!edition.fighters.includes(fighter))return false;
    if(edition.skins==='all')return true;
    return key===fighter||/^_(head|torso|glove_(left|right)|boot_(left|right)|ponytail(_(left|right))?|scarf)$/.test(key.slice(fighter.length));
  };
  const selected=[];
  for(const entry of source){
    if(!/^(loose|atlas)\/[A-Za-z0-9_.-]+$/.test(entry.path))throw Error('Unsafe asset manifest path');
    const bytes=fs.readFileSync(path.join(directory,entry.path));
    if(crypto.createHash('sha256').update(bytes).digest('hex')!==entry.hash)throw Error('Prepared asset checksum mismatch: '+entry.path);
    if(keep(entry.path))selected.push(entry);else fs.rmSync(path.join(directory,entry.path));
  }
  const replace=(relative,value)=>{
    const bytes=Buffer.from(JSON.stringify(value));fs.writeFileSync(path.join(directory,relative),bytes);
    const entry=selected.find(item=>item.path===relative);if(!entry)throw Error('Required index absent: '+relative);
    entry.hash=crypto.createHash('sha256').update(bytes).digest('hex');
  };
  // CG uses all MASTER groups: do not rewrite an identical index merely to change formatting.
  if(JSON.stringify(Object.keys(allowedGroups))!==JSON.stringify(Object.keys(groups)))replace('atlas/groups.json',allowedGroups);
  if(JSON.stringify(Object.keys(allowedAnimations))!==JSON.stringify(Object.keys(animations)))replace('atlas/animations.json',allowedAnimations);
  const aliases=read('loose/part-mirrors.json');
  const legalAliases=Object.fromEntries(Object.entries(aliases).filter(([key])=>keep('loose/'+key+'.webp')));
  for(const [key,alias] of Object.entries(legalAliases))if(!selected.some(entry=>entry.path==='loose/'+alias.source+'.webp'))throw Error('Missing mirror source: '+key);
  if(Object.keys(legalAliases).length!==Object.keys(aliases).length)replace('loose/part-mirrors.json',legalAliases);
  for(const fighter of edition.fighters)if(!selected.some(entry=>entry.path==='loose/portrait_'+fighter+'.webp'))throw Error('Missing edition portrait: '+fighter);
  fs.writeFileSync(manifestPath,JSON.stringify(selected));
  return {sourceManifestSha256:sourceHash,selectedManifestSha256:crypto.createHash('sha256').update(JSON.stringify(selected)).digest('hex'),sourceFiles:source.length,selectedFiles:selected.length,removedFiles:source.length-selected.length,skins:edition.skins};
}
