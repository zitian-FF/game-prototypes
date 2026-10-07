// Pure simulation types. Nothing in src/sim/ may touch Phaser, the DOM, or
// wall-clock time: the same state + the same inputs must always produce the
// same next state, which is what the rollback netcode relies on.

export type PunchType = 'jab' | 'cross' | 'hook' | 'uppercut';
export type FatiguedPunch = 'jab' | 'cross' | 'hook';
export const FATIGUED_PUNCHES: readonly FatiguedPunch[] = ['jab', 'cross', 'hook'];

export type Phase = 'startup' | 'sweet' | 'sour' | 'recovery';

// One tick of intents for one fighter. Movement is quantised to integers in
// [-100, 100] so it serialises compactly and identically on both peers.
export interface FrameInput {
  mx: number;
  my: number;
  jab: boolean;
  cross: boolean;
  hook: boolean;
  uppercut: boolean;
  dodge: boolean;
  guard: boolean;
}

export const NEUTRAL_INPUT: FrameInput = {
  mx: 0,
  my: 0,
  jab: false,
  cross: false,
  hook: false,
  uppercut: false,
  dodge: false,
  guard: false,
};

export interface PunchState {
  type: PunchType;
  frame: number;
  startup: number;
  // Early sour: fist still extending toward full reach (a jammed punch).
  sourEarly: number;
  sweet: number;
  // Late sour: fist at full reach, past its sweet moment.
  sour: number;
  recovery: number;
  // Full reach and the reach it starts from (character-adjusted).
  reach: number;
  startReach: number;
  damageMult: number;
  // Resolved = this punch already hit, was blocked, or was dodged. One
  // contact per punch.
  resolved: boolean;
  connected: boolean;
  // Powered up by the post-dodge buff.
  buffed: boolean;
  // 0 = lead (left) hand, 1 = rear (right) hand. Cosmetic only.
  hand: 0 | 1;
}

export interface DodgeState {
  frame: number;
  dx: number;
  dy: number;
}

export type BufferedAction = PunchType | 'dodge';

export interface Fighter {
  x: number;
  y: number;
  fx: number;
  fy: number;
  health: number;
  stamina: number;
  stun: number;
  stunDecayWait: number;
  stars: number;
  fatigue: Record<FatiguedPunch, number>;
  // Frames left before each type's fatigue starts decaying (reset on throw).
  fatigueWait: Record<FatiguedPunch, number>;
  punch: PunchState | null;
  dodge: DodgeState | null;
  postDodgeVulnerable: number;
  stunTimer: number;
  stunFromMeter: boolean;
  guarding: boolean;
  guardFrames: number;
  // Vulnerable frames remaining after lowering guard; prevents re-guarding.
  guardPenalty: number;
  exhausted: boolean; // Emergency recovery: protected meter, exits only at full.
  regenWait: number;
  buffered: BufferedAction | null;
  bufferFrames: number;
  nextHookHand: 0 | 1;
  // Frames left in which the next punch is powered up (after a dodge).
  dashBuff: number;
  // Training-dummy flags (unused in PvP).
  anchored: boolean;
  infiniteStamina: boolean;
  // Training only: dummy held in the Vulnerable stance.
  forceVulnerable: boolean;
  framesSinceHit: number;
  // Character id (see sim/character.ts).
  char: string;
  // Pushback from a landed/blocked punch: per-tick step, ticks left.
  pushX: number;
  pushY: number;
  pushFrames: number;
  // Ticks the player's own walking stays locked after a push lands.
  pushLock: number;
  // The last blow that took health (a finishing blow decides the KO style).
  lastBlow: LastBlow | null;
}

export interface LastBlow {
  punch: PunchType;
  sweet: boolean;
  chip: boolean;
  // Attacker's facing when it landed = direction the loser is knocked.
  dx: number;
  dy: number;
}

// drop = slumps where they stand; fly = knocked to the ropes and sits down.
export type KoStyle = 'drop' | 'fly';

export type Stance = 'dodging' | 'perfectGuard' | 'guard' | 'normal' | 'vulnerable';

export type SimEvent =
  | { kind: 'staminaRejected'; fighter: number }
  | {
      kind: 'hit';
      attacker: number;
      x: number;
      y: number;
      punch: PunchType;
      sweet: boolean;
      counter: boolean;
      row: 'normal' | 'vulnerable';
      damage: number;
      buffed: boolean;
    }
  | { kind: 'block'; attacker: number; x: number; y: number; sweet: boolean; chip: number }
  | { kind: 'perfectGuard'; attacker: number; x: number; y: number }
  | { kind: 'dodged'; attacker: number; x: number; y: number }
  | { kind: 'whiff'; attacker: number; punch: PunchType }
  | { kind: 'throw'; attacker: number; punch: PunchType; tired: boolean }
  | { kind: 'stunned'; fighter: number }
  | { kind: 'starsReady'; fighter: number }
  | { kind: 'ready' }
  | { kind: 'go' }
  | { kind: 'ko'; loser: number }
  | { kind: 'timeUp'; winner: number | null };

export interface MatchResult {
  winner: number | null;
  reason: 'ko' | 'time';
  ko?: { loser: number; style: KoStyle; dx: number; dy: number };
}

export interface SimState {
  tick: number;
  fighters: [Fighter, Fighter];
  timed: boolean;
  // Hit-stop: frames left in which the fight is frozen after a hit.
  hitstop: number;
  // Tick at which the round actually starts (after READY... GO!).
  fightStartTick: number;
  result: MatchResult | null;
}
