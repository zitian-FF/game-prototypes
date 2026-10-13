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
