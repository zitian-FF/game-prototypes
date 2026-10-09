import { tune } from './tune';
import { fighterScale } from './geometry';
import type { Fighter, PunchType } from './types';

// Characters: per-fighter overrides on top of the shared tune
// (tune.characters.<id>). Multipliers for HP, stamina, regen, stun
// threshold, walk speed and per-punch damage / stamina cost / stun build /
// pushback / reach; frame deltas for startup / recovery; extra fatigue bars.
// Everything else (sweet / sour windows, hit table, guard, dodge, stars,
// fatigue rules) stays global so every character reads the same.
// Deterministic: the sim only reads tune + the fighter's character id.

export const CHARACTER_IDS = ['marco', 'mia', 'bruno', 'tee', 'tyke', 'dragon'] as const;
export type CharId = (typeof CHARACTER_IDS)[number];

export const CHARACTER_INFO: Record<CharId, { name: string; nick: string; style: string }> = {
  tyke: { name: 'Tyke Maison', nick: 'Thunder', style: 'Heavyweight champion; provisional stats pending tuning' },
  dragon: { name: 'Dragon', nick: 'The Blind Fist', style: 'Karate fighter; provisional stats pending tuning' },
  tee: { name:'G.P. Tee',nick:'Tee',style:'Explosive power and speed; fragile and low endurance' },
  marco: { name: 'Marco Reyes', nick: 'The Metronome', style: 'Steady all-rounder with a heavy Cross' },
  mia: { name: 'Mia Tanaka', nick: 'Flicker', style: 'Fast hands and feet, shorter reach' },
  bruno: { name: 'Bruno Kowalski', nick: 'Brick', style: 'Tough and heavy-handed, slow' },
};

// Short display name (first name, upper case).
export function charName(id: string): string {
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

export const maxHealth = (f: Fighter) => tune.health.max * ct(f).hp;
export const maxStamina = (f: Fighter) => tune.stamina.max * ct(f).stamina;
export const regenMult = (f: Fighter) => ct(f).regen;
export const stunThreshold = (f: Fighter) => tune.stun.threshold * ct(f).stun;
export const moveSpeed = (f: Fighter) => tune.movement.speed * ct(f).speed;

export interface PunchCfg {
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
    fatigueBars: bars,
    fatigueSpeedPerBar: (base.fatigueSpeedPerBar ?? 0) * spread,
    fatigueDamagePerBar: (base.fatigueDamagePerBar ?? 0) * spread,
  };
}
