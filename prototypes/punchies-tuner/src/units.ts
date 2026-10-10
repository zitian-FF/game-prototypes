const coreUnits:Record<string,string>={hp:'HP',stamina:'stamina points',stun:'stun points',speed:'px/s',regen:'stamina points/s'};
const punchUnits:Record<string,string>={damage:'HP damage',staminaCost:'stamina points',staminaDamage:'stamina damage',stunBuild:'stun damage',reach:'px',hitRadius:'px',pushHit:'px',pushBlock:'px',startup:'frames',sourEarly:'frames',sweet:'frames',sour:'frames',recovery:'frames',whiffRecovery:'frames',fatigueBars:'fatigue bars',fatigueSpeedPerBar:'ratio/bar',fatigueDamagePerBar:'ratio/bar',startReachFrac:'ratio (0-1)',guardChipMult:'multiplier',crossDamageMult:'multiplier'};
const sharedUnits:Record<string,string>={
 'health.max':'HP','stamina.max':'stamina points','stamina.regenIdlePerSec':'stamina points/s','stamina.regenActivePerSec':'stamina points/s',
 'stun.threshold':'stun points','stun.decayPerSec':'stun points/s','stun.overflowFramesPerPoint':'frames/stun point',
 'movement.speed':'px/s','movement.minSeparation':'px','hit.attackerStaminaPenalty':'stamina points',
 'fatigue.perUse':'fatigue bars/use','fatigue.decayPerSec':'fatigue bars/s','fatigue.freeUses':'uses',
 'stars.max':'stars','stars.counterGain':'stars','guard.staminaDrainPerSec':'stamina points/s','guard.perfectGuardStaminaGain':'stamina points','guard.perfectGuardStunBuild':'stun damage',
 'dodge.speed':'px/s','dodge.staminaCost':'stamina points','dodge.neutralDeadzone':'ratio (0-1)',
 'body.hurtRadius':'px','body.coreRadius':'px','body.vulnerableHurtRadius':'px','view.fighterScale':'multiplier'
};
export function storedUnit(path:string):string {
 const parts=path.split('.'),key=parts[parts.length-1];
 if(path.startsWith('body.proportions.'))return 'multiplier (Base = 1)';
 if(parts[0]==='characters')return ['startup','recovery'].includes(key)?'added frames':key==='fatigueBars'?'added fatigue bars':'multiplier';
 if(parts[0]==='punches'&&punchUnits[key])return punchUnits[key];
 if(sharedUnits[path])return sharedUnits[path];
 if(key.endsWith('Frames')||key==='frames'||key==='iFrames')return 'frames';
 if(key.endsWith('Mult'))return 'multiplier';
 throw Error(`Missing tuning unit: ${path}`);
}
export function rowUnits(path:string|null,section:string,key:string):{stored:string;effective:string} {
 const effective=section==='core'?coreUnits[key]:section==='defense'?(key==='proportion'?'multiplier (Base = 1)':key==='fighterScale'?'multiplier':'px'):punchUnits[key];
 return {stored:path?storedUnit(path):'shared',effective:effective??(path?storedUnit(path):'shared')};
}
