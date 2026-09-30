// Pure simulation types. Nothing in src/sim/ may touch Phaser, the DOM, or
// wall-clock time: the same state + the same inputs must always produce the
// same next state, which is what the lockstep netcode (step 5) relies on.

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
  punch: PunchState | null;
  dodge: DodgeState | null;
  postDodgeVulnerable: number;
  stunTimer: number;
  stunFromMeter: boolean;
  guarding: boolean;
  guardFrames: number;
  // Frames since guard was last down, and whether this raise may Perfect
  // Guard (only if guard was down >= guard.perfectCooldownFrames).
  guardDownFrames: number;
  perfectEligible: boolean;
  exhausted: boolean;
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
}

export type Stance = 'dodging' | 'perfectGuard' | 'guard' | 'normal' | 'vulnerable';

export type SimEvent =
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
  | { kind: 'throw'; attacker: number; punch: PunchType }
  | { kind: 'stunned'; fighter: number }
  | { kind: 'starsReady'; fighter: number }
  | { kind: 'ko'; loser: number }
  | { kind: 'timeUp'; winner: number | null };

export interface MatchResult {
  winner: number | null;
  reason: 'ko' | 'time';
}

export interface SimState {
  tick: number;
  fighters: [Fighter, Fighter];
  timed: boolean;
  // Hit-stop: frames left in which the fight is frozen after a hit.
  hitstop: number;
  result: MatchResult | null;
}
