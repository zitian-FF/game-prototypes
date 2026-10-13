import initial from '../../tune.json';
import english from '../i18n/locales/en.json';
export const archetypeKeys=['char.base.nick',...Object.keys(initial.characters).map(id=>`char.${id}.nick`)];
export const defaultArchetypes=english as Record<string,string>;
export function readArchetypes(doc:unknown):Record<string,string>{
  const source=(doc as {balanceWorkshop?:{archetypes?:unknown}})?.balanceWorkshop?.archetypes;
  if(source===undefined)return {};
  if(!source||typeof source!=='object'||Array.isArray(source))throw Error('Invalid archetype text');
  for(const [key,value] of Object.entries(source))if(!archetypeKeys.includes(key)||typeof value!=='string'||!value.trim()||value.length>80||/[\r\n\x00-\x1f{}]/.test(value))throw Error(`Invalid archetype ${key}: use 1–80 plain-text characters`);
  return {...source} as Record<string,string>;
}
