import type {Bindings,Layouts} from './layouts';
export type RosterCommand='up'|'down'|'left'|'right'|'skinPrev'|'skinNext'|'difficultyPrev'|'difficultyNext'|'format'|'confirm'|'back';
export type KeyboardProfile='kb1'|'kb2';
const actions={jab:'skinPrev',cross:'skinNext',hook:'difficultyPrev',uppercut:'difficultyNext',dodge:'format'} as const;
const directions=['up','down','left','right'] as const;
export function dedicatedKeys(profile:KeyboardProfile,local:boolean){return local&&profile==='kb2'?{confirm:'NumpadEnter',back:'Backspace'}:{confirm:'Enter',back:'Escape'};}
export function keyboardCommands(bindings:Bindings<string>,profile:KeyboardProfile,local:boolean):Map<string,RosterCommand>{
 const result=new Map<string,RosterCommand>(),dedicated=dedicatedKeys(profile,local);
 result.set(dedicated.confirm,'confirm');result.set(dedicated.back,'back');
 for(const action of directions)for(const key of bindings[action]??[])if(!result.has(key))result.set(key,action);
 for(const [action,command] of Object.entries(actions))for(const key of bindings[action as keyof typeof actions]??[])if(!result.has(key))result.set(key,command);
 return result;
}
export function rosterKey(code:string,layouts:Layouts,local:boolean,activeProfile:KeyboardProfile,owned:KeyboardProfile[]=['kb1','kb2']):{profile:KeyboardProfile;command:RosterCommand}|undefined{
 if(!local){const command=keyboardCommands(layouts[activeProfile],activeProfile,false).get(code);return command?{profile:activeProfile,command}:undefined;}
 // Dedicated local controls are unambiguous even if mapped as combat keys.
 for(const profile of owned){const dedicated=dedicatedKeys(profile,true);if(code===dedicated.confirm)return {profile,command:'confirm'};if(code===dedicated.back)return {profile,command:'back'};}
 const matches=owned.flatMap(profile=>{const command=keyboardCommands(layouts[profile],profile,true).get(code);return command?[{profile,command}]:[];});
 return matches.length===1?matches[0]:undefined;
}
export const PAD_ROSTER:Record<number,RosterCommand>={0:'confirm',1:'back',2:'difficultyPrev',3:'difficultyNext',5:'format',6:'skinPrev',7:'skinNext',12:'up',13:'down',14:'left',15:'right'};
export function rosterHintKeys(action:'navigate'|'skins'|'difficulty'|'format'|'confirm'|'back',layouts:Layouts,profile:KeyboardProfile,local:boolean,pad:boolean,owned:KeyboardProfile[]=['kb1','kb2']):(string|number)[]{
 const commands:RosterCommand[]=action==='navigate'?['up','left','down','right']:action==='skins'?['skinPrev','skinNext']:action==='difficulty'?['difficultyPrev','difficultyNext']:[action];
 if(pad)return action==='navigate'?[10]:commands.map(command=>Number(Object.keys(PAD_ROSTER).find(key=>PAD_ROSTER[Number(key)]===command)));
 return commands.flatMap(command=>{const key=[...keyboardCommands(layouts[profile],profile,local)].find(([key,value])=>value===command&&rosterKey(key,layouts,local,profile,owned)?.profile===profile)?.[0];return key?[key]:[];});
}
