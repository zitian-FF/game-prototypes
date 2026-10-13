import { tune } from './tune';
import { fighterScale } from './geometry';
import type { Fighter, PunchType } from './types';

// Characters: per-fighter overrides on top of the shared tune
// (tune.characters.<id>). Multipliers for HP, stamina, regen, stun
// threshold, walk speed and per-punch damage / stamina cost / stun build /
// pushback / reach; frame deltas for startup / recovery; extra fatigue bars.
// Everything else (sweet / sour windows, hit table, guard, dodge, star earning,
// fatigue rules) stays global so every character reads the same.
// Deterministic: the sim only reads tune + the fighter's character id.

export const ALL_CHARACTER_IDS = ['marco', 'mia', 'bruno', 'tee', 'tyke', 'dragon', 'longan', 'captain', 'roxy', 'nadia', 'kai'] as const;
export type CharId = (typeof ALL_CHARACTER_IDS)[number];
export const CHARACTER_IDS:readonly CharId[]=ALL_CHARACTER_IDS;

export const CHARACTER_INFO: Record<CharId, { name: string; nick: string; style: string }> = {
  kai: {name:'Kai Chen',nick:'Courier',style:'Slow courier: strong hooks, weak Jab and Cross, longer dash.'},
  roxy: { name: 'Roxy', nick: 'Firecracker', style: 'Close-range brawler: heavy hooks, costly swings.' },
  nadia: { name: 'Nadia', nick: 'Rising Star', style: 'Fast, light Cross pressure with extra fatigue capacity.' },
  captain: { name: 'Captain Eagle', nick: 'Full Throttle', style: 'Mobile burst fighter: quick recovery, costly pressure and lower durability.' },
  longan: { name: 'Longan', nick: 'Still Waters', style: 'Endurance specialist: efficient pressure and a weak one-star uppercut.' },
  tyke: { name: 'Tyke Maison', nick: 'Thunder', style: 'Precision powerhouse: crushing blows, tires quickly, easily stunned.' },
  dragon: { name: 'Dragon', nick: 'The Blind Fist', style: 'Long-range outboxer: extended jab and Cross, slower follow-through.' },
  tee: { name:'G.P. Tee',nick:'Tee',style:'Fast burst attacker: heavy Cross and hooks, fragile with low stamina.' },
  marco: { name: 'Marco Reyes', nick: 'The Metronome', style: 'Steady all-rounder: stronger Cross, balanced speed and endurance.' },
  mia: { name: 'Mia Tanaka', nick: 'Flicker', style: 'Agile pressure fighter: fast hands, extra jab fatigue capacity, short reach.' },
  bruno: { name: 'Bruno Kowalski', nick: 'Brick', style: 'Durable bruiser: heavy blows, extra fatigue capacity, slow recovery.' },
};

// Short display name (first name, upper case).
export function charName(id: string): string {
  if(id==='captain')return 'CAPTAIN EAGLE';
  if(id==='tee')return 'G.P. TEE';
  return CHARACTER_INFO[isCharId(id) ? id : 'marco'].name.split(' ')[0].toUpperCase();
}

export function isCharId(v: unknown): v is CharId {
  return typeof v === 'string' && (CHARACTER_IDS as readonly string[]).includes(v);
}

type CharTune = (typeof tune.characters)['marco'];

export function charTune(id: string): CharTune {
  return tune.characters[isCharId(id) ? id : 'marco'];
}

const ct = (f: Fighter) => charTune(f.char);

// One charge per fighter: its requirement is also its meter capacity.
// Older combat fixtures use the shared Base requirement.
export function uppercutStars(f: Fighter | string): number {
  const u = charTune(typeof f === 'string' ? f : f.char).uppercut as { starRequirement?: number };
  return Math.max(1, Math.min(4, Math.round(u.starRequirement ?? tune.stars.max)));
}


export const maxHealth = (f: Fighter) => tune.health.max * ct(f).hp;
export const maxStamina = (f: Fighter) => tune.stamina.max * ct(f).stamina;
export const regenMult = (f: Fighter) => ct(f).regen;
export const stunThreshold = (f: Fighter) => tune.stun.threshold * ct(f).stun;
export const moveSpeed = (f: Fighter) => tune.movement.speed * ct(f).speed;

/** Optional character draft overrides; existing fighters keep the shared rules. */
export function characterDodge(f: Fighter): { speed: number; frames: number; iFrames: number } {
  const o = ct(f) as CharTune & { dodge?: { speedMult: number; framesMult: number; iFramesMult: number } };
  const frames = Math.max(1, Math.round(tune.dodge.frames * (o.dodge?.framesMult ?? 1)));
  return { speed: tune.dodge.speed * (o.dodge?.speedMult ?? 1), frames,
    iFrames: Math.min(frames, Math.max(0, Math.round(tune.dodge.iFrames * (o.dodge?.iFramesMult ?? 1)))) };
}
export function punchFreeUses(f: Fighter, type: PunchType): number {
  const o = ct(f)[type] as { freeUses?: number };
  // Fatigue is sampled before incrementing the throw counter. The optional
  // override means exactly N unpenalized throws; preserve legacy global timing.
  return o.freeUses === undefined ? tune.fatigue.freeUses : Math.max(0, o.freeUses - tune.fatigue.perUse);
}

export interface PunchCfg {
  starRequirement: number;
  startup: number;
  sourEarly: number;
  sweet: number;
  sour: number;
  recovery: number;
  whiffRecovery: number;
  reach: number;
  hitRadius: number;
  damage: number;
  staminaCost: number;
  staminaDamage: number;
  stunBuild: number;
  startReachFrac: number;
  pushHit: number;
  pushBlock: number;
  hitStun: number;
  blockStun: number;
  sourStun: number;
  fatigueBars: number;
  fatigueSpeedPerBar: number;
  fatigueDamagePerBar: number;
}

// One punch's numbers for this fighter. Uppercut damage is derived from the
// Cross (see sim); its `damage` here is the character multiplier alone.
export function punchCfg(f: Fighter | string, type: PunchType): PunchCfg {
  const base = tune.punches[type] as unknown as Record<string, number>;
  const o = charTune(typeof f === 'string' ? f : f.char)[type];
  const baseBars = base.fatigueBars ?? 0;
  const bars = Math.max(0, baseBars + o.fatigueBars);
  // Extra bars spread the same maximum penalty thinner.
  const spread = bars > 0 && baseBars > 0 ? baseBars / bars : 1;
  return {
    starRequirement: uppercutStars(f),
    startup: Math.max(1, base.startup + o.startup),
    sourEarly: base.sourEarly,
    sweet: base.sweet,
    sour: base.sour,
    recovery: Math.max(1, base.recovery + o.recovery),
    whiffRecovery: base.whiffRecovery,
    reach: base.reach * o.reach * fighterScale(f),
    hitRadius: base.hitRadius * fighterScale(f),
    damage: (base.damage ?? 1) * o.damage,
    staminaCost: base.staminaCost * o.staminaCost,
    staminaDamage: base.staminaDamage,
    stunBuild: base.stunBuild * o.stunBuild,
    startReachFrac: base.startReachFrac,
    pushHit: base.pushHit * o.push,
    pushBlock: base.pushBlock * o.push,
    // Stun frames travel with the push: a harder shove locks the defender longer.
    hitStun: Math.round(base.hitStun * o.push),
    blockStun: Math.round(base.blockStun * o.push),
    sourStun: Math.round(base.sourStun * o.push),
    fatigueBars: bars,
    fatigueSpeedPerBar: (base.fatigueSpeedPerBar ?? 0) * spread,
    fatigueDamagePerBar: (base.fatigueDamagePerBar ?? 0) * spread,
  };
}
