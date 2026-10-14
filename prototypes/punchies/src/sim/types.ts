// Pure simulation types. Nothing in src/sim/ may touch Phaser, the DOM, or
// wall-clock time: the same state + the same inputs must always produce the
// same next state, which is what the rollback netcode relies on.

export type PunchType = 'jab' | 'cross' | 'hook' | 'uppercut';
export type SuperId='rising-upper'|'code-x'|'buffalo-hook'|'wave-motion-blast'|'eagle-punch';
export interface EagleState {activationId:number;frame:number;startup:number;dashFrames:number;endFrame:number;launched:boolean;fx:number;fy:number;distance:number;dashProgress:number;startX:number;startY:number;endX:number;endY:number;bodyX:number;bodyY:number;previousFistX:number;previousFistY:number;hitIds:string[]}
export interface WaveState {activationId:number;frame:number;startup:number;endFrame:number;originX:number;originY:number;fx:number;fy:number;speed:number;startSpeedRatio:number;accelerationFrames:number;radius:number;buffed:boolean;launched:boolean}
export interface CodeXTrack {startX:number;startY:number;endX:number;endY:number;startFrame:number}
export interface CodeXState {activationId:number;frame:number;endFrame:number;targetId:string;targetX:number;targetY:number;tracks:[CodeXTrack,CodeXTrack];buffed:boolean;crossFatigueMult:number;hitIds:[string[],string[]]}

export type SuperCancelReason='startupHit'|'stun'|'perfectGuard';
export type FatiguedPunch = 'jab' | 'cross' | 'hook';
export const FATIGUED_PUNCHES: readonly FatiguedPunch[] = ['jab', 'cross', 'hook'];

export type Phase = 'startup' | 'sweet' | 'sour' | 'recovery';

// One tick of intents for one fighter. Movement is quantised to integers in
// [-100, 100] so it serialises compactly and identically on both peers.
export interface FrameInput {
  normalAttack?:boolean;
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
  codeXActivation?:{fx:number;fy:number};
  shadowSuper?:boolean;
  waveSuper?:boolean;
  eagleSuper?:boolean;
  baseDamage?:number;buffaloActivation?:boolean;buffaloUpper?:boolean;buffaloConfirm?:{targetId:string;x:number;y:number};
  type: PunchType;
  frame: number;
  startup: number;
  // Early sour: fist still extending toward full reach (a jammed punch).
  sourEarly: number;
  sweet: number;
  // Late sour: fist at full reach, past its sweet moment.
  sour: number;
  recovery: number;
  // Extra recovery frames added when the punch whiffed (the tail of recovery).
  whiffFrames: number;
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
  readonly controlMode:'modern'|'classic';
  readonly healthMultiplier:number;
  modernStick:import('./modernControls').ModernStickState;
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
  codeX:CodeXState|null;
  wave:WaveState|null;
  eagle:EagleState|null;
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
  lock: number; // frames of hit/block stun left: no actions, no walking
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
  | {kind:'eagleStarted'|'eagleLaunched'|'eagleFinished';attacker:number;activationId:number}
  | {kind:'eagleContact';attacker:number;activationId:number;victimId:string;x:number;y:number;outcome:'hit'|'perfectGuard'|'dodged'}
  | {kind:'waveLaunched'|'waveFinished';attacker:number;activationId:number}
  | {kind:'waveContact';attacker:number;activationId:number;victimId:string;x:number;y:number;outcome:'hit'|'blocked'|'perfectGuard'|'dodged'}
  | {kind:'buffaloFollowup';attacker:number;targetId:string;x:number;y:number}
  | {kind:'codeXLaunched';attacker:number;activationId:number;endFrame:number;targetId:string;targetX:number;targetY:number;tracks:[CodeXTrack,CodeXTrack]}
  | {kind:'codeXFinished';attacker:number;activationId:number}
  | {kind:'codeXContact';attacker:number;activationId:number;shadow:0|1;victimId:string;x:number;y:number;outcome:'hit'|'dodged'|'blocked'|'perfectGuard'}
  | {kind:'sweetImpact';attacker:number;x:number;y:number;punch:PunchType}
  | {kind:'superCharged';fighter:number;superId:SuperId;starCost:number}
  | {kind:'superCancelled';fighter:number;superId:SuperId;starCost:number;reason:SuperCancelReason}
  | {kind:'superChargeLost';fighter:number;superId:SuperId;starCost:number;reason:'sweetHit'}
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
  | { kind: 'fightCue' }
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
