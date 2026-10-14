import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import type {Plugin} from 'vite';
import {packLocale} from './punchies-json-packing';
const root=path.resolve('.'),source=path.join(root,'prototypes/punchies/src');
const normalized=(value:string)=>value.split('\\').join('/');
const excludedProfile=new Set(['profile.level','profile.max','profile.xp','profile.daily_xp','profile.daily_cap','profile.level_up','profile.rewards','profile.result_xp','profile.reward_track','profile.next_rewards']);
function locale(raw:Record<string,string>,fighters:readonly string[]):Record<string,string>{return Object.fromEntries(Object.entries(raw).filter(([key])=>!(key.startsWith('shop.')&&key!=='shop.default')&&!(key.startsWith('quote.')&&!fighters.includes(key.slice(6)))&&!key.startsWith('title.')&&!key.startsWith('survival.')&&!key.startsWith('reward.')&&!excludedProfile.has(key)));}
/** Thin Beta policy/UI adapters, applied before bundling the shared game. */
export function betaBuildPlugin(edition:{name:string;fighters:string[]}):Plugin|null{
 if(edition.name!=='itchbeta')return null;
 const replacements:Record<string,string>={
  'shop/draft.ts':'shop.ts','shop/roster.ts':'roster.ts','progress/progress.ts':'progress.ts','progress/titles.ts':'titles.ts',
  'firstrun/state.ts':'firstRun.ts','portal/select.ts':'portal.ts',
  'scenes/ProfileScene.ts':'ProfileScene.ts','ui/titleProfileEntry.ts':'titleProfileEntry.ts','ui/resultProgress.ts':'resultProgress.ts',
 };
 const aliases=new Map(Object.entries(replacements).map(([from,to])=>[normalized(path.join(source,from)),path.join(source,'editions/beta',to)]));
 const canonical=(id:string,importer?:string)=>{
  const clean=id.split('?')[0];let file=clean.startsWith('.')&&importer?path.resolve(path.dirname(importer.split('?')[0]),clean):clean;
  if(!path.extname(file))file+='.ts';return normalized(file);
 };
 const read=(name:string)=>JSON.parse(fs.readFileSync(path.join(source,name),'utf8'));
 return {
  name:'punchies-beta-build',enforce:'pre',
  resolveId(id,importer){
   if(id.startsWith('\0punchies-beta:'))return id;
   const file=canonical(id,importer),replacement=aliases.get(file);if(replacement)return replacement;
   if(file===normalized(path.join(source,'progress/progress-config.json')))return '\0punchies-beta:progress-config';
   if(file===normalized(path.join(source,'sim/super-config.json')))return '\0punchies-beta:super-config';
   const language=file.match(/\/prototypes\/punchies\/src\/i18n\/locales\/(en|ja|ko|zh|es|ar)\.json$/)?.[1];
   if(language)return '\0punchies-beta:locale-'+language;
  },
  load(id){
   if(id==='\0punchies-beta:progress-config')return 'export default {maxLevel:1};';
   if(id==='\0punchies-beta:super-config'){
    const config=read('sim/super-config.json');config.characters=Object.fromEntries(Object.entries(config.characters).filter(([key])=>edition.fighters.includes(key)));
    return 'export default '+JSON.stringify(config)+';';
   }
   if(id.startsWith('\0punchies-beta:locale-')){
    const language=id.slice('\0punchies-beta:locale-'.length),value=locale(read('i18n/locales/'+language+'.json'),edition.fighters);
    return language==='en'?'export default '+JSON.stringify(value)+';':packLocale(locale(read('i18n/locales/en.json'),edition.fighters),value).replace("from './en.json'",'from '+JSON.stringify('\0punchies-beta:locale-en'));
   }
  },
  transform(code,id){
   const file=normalized(id.split('?')[0]);
   if(file.endsWith('/prototypes/punchies/src/render/paletteCatalog.ts'))return {code:'export const PALETTES={};',map:null};
   if(file.endsWith('/prototypes/punchies/src/boot.ts')){
    for(const scene of ['Shop','FirstFight','Survival','SurvivalEntry']){
     code=code.replace(new RegExp(`import \\{ ${scene}Scene \\} from './scenes/${scene}Scene';\\r?\\n`),'');
     code=code.replace(new RegExp(`game\\.scene\\.add\\('${scene}', ${scene}Scene, false\\);\\r?\\n`),'');
    }
    return {code,map:null};
   }
   if(file.endsWith('/prototypes/punchies/src/sim/character.ts')){
    const tree=ts.createSourceFile(id,code,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
    for(const statement of tree.statements)if(ts.isVariableStatement(statement))for(const declaration of statement.declarationList.declarations){
     if(declaration.name.getText(tree)!=='CHARACTER_INFO'||!declaration.initializer||!ts.isObjectLiteralExpression(declaration.initializer))continue;
     const properties=declaration.initializer.properties.filter(p=>ts.isPropertyAssignment(p)&&edition.fighters.includes(p.name.getText(tree).replace(/^['"]|['"]$/g,'')));
     if(properties.length!==edition.fighters.length)throw Error('Beta character metadata is incomplete');
     code=code.slice(0,declaration.initializer.getStart(tree))+'{'+properties.map(p=>p.getText(tree)).join(',')+'}'+code.slice(declaration.initializer.end);
    }
    return {code,map:null};
   }
  },
 };
}
