import config from './super-config.json';
import {charTune,punchCfg,uppercutStars} from './character';
import type {Fighter,SuperId} from './types';
export {default as superBalanceConfig} from './super-config.json';
export interface Super {
 id:SuperId;nameKey:'super.rising_upper'|'super.code_x'|'super.buffalo_hook'|'super.wave_motion_blast'|'super.eagle_punch';descriptionKey:'super.rising_upper_description'|'super.code_x_description'|'super.buffalo_hook_description'|'super.wave_motion_blast_description'|'super.eagle_punch_description';mechanic:'uppercut'|'jab'|'hook'|'projectile'|'dash';initialDamage?:number;followupDamage?:number;starCost:number;
 referenceStarCost:number;powerPerStar:number;damageMultiplier:number;
}
/** Legacy upper.damage already includes each fighter's cost budget. Normalize once.
 * Current cost/reference=1 preserves exact damage; future cost-only changes scale linearly.
 * Input/save/tune identifiers remain uppercut for compatibility. */
export function fighterSuper(fighter:Fighter|string):Super {
 const id=typeof fighter==='string'?fighter:fighter.char;
 const referenceStarCost=charTune(id).uppercut.referenceStarCost;
 const starCost=uppercutStars(fighter),legacyPower=punchCfg(fighter,'uppercut').damage;
 const ability=id==='tee'?config.characters.tee:id==='tyke'?config.characters.tyke:id==='dragon'?config.characters.dragon:id==='captain'?config.characters.captain:config.defaultSuper;
 return {...ability,id:ability.id as SuperId,nameKey:ability.nameKey as Super['nameKey'],descriptionKey:ability.descriptionKey as Super['descriptionKey'],mechanic:ability.mechanic as Super['mechanic'],
  starCost,referenceStarCost,powerPerStar:legacyPower/referenceStarCost,damageMultiplier:legacyPower*(starCost/referenceStarCost)};
}
/** Charge state only, not action availability while locked/stunned/dodging. */
export function superReady(fighter:Fighter):boolean {return fighter.stars>=uppercutStars(fighter);}
