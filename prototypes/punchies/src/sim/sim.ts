import { tune, TICK_RATE } from './tune';
import { fighterScale, normalHurtRadius, coreRadius, separation } from './geometry';
import type {
  BufferedAction,
  Fighter,
  FrameInput,
  KoStyle,
  LastBlow,
  Phase,
  PunchState,
  PunchType,
  SimEvent,
  SimState,
  Stance,
} from './types';
import { FATIGUED_PUNCHES } from './types';
import { maxHealth, maxStamina, moveSpeed, punchCfg, regenMult, stunThreshold } from './character';

// Deterministic fight simulation, stepped at a fixed 60 Hz. Only uses
// + - * / and Math.sqrt/round/min/max/abs (all exactly specified by IEEE
// 754 / ECMAScript), never trig, so both online peers stay in sync (and rollback replays exactly).

export interface FighterOptions {
  anchored?: boolean;
  infiniteStamina?: boolean;
  forceVulnerable?: boolean;
  char?: string;
}

function createFighter(x: number, y: number, opts: FighterOptions): Fighter {
  const f: Fighter = {
    x,
    y,
    fx: 1,
    fy: 0,
    health: tune.health.max,
    stamina: tune.stamina.max,
    stun: 0,
    stunDecayWait: 0,
    stars: 0,
    fatigue: { jab: 0, cross: 0, hook: 0 },
    fatigueWait: { jab: 0, cross: 0, hook: 0 },
    punch: null,
    dodge: null,
    postDodgeVulnerable: 0,
    stunTimer: 0,
    stunFromMeter: false,
    guarding: false,
    guardFrames: 0,
    guardPenalty: 0,
    exhausted: false,
    regenWait: 0,
    buffered: null,
    bufferFrames: 0,
    nextHookHand: 0,
    dashBuff: 0,
    anchored: opts.anchored ?? false,
    infiniteStamina: opts.infiniteStamina ?? false,
    forceVulnerable: opts.forceVulnerable ?? false,
    framesSinceHit: 0,
    lastBlow: null,
    pushX: 0,
    pushY: 0,
    pushFrames: 0,
    pushLock: 0,
    char: opts.char ?? 'marco',
  };
  f.health = maxHealth(f);
  f.stamina = maxStamina(f);
  return f;
}

export function createSimState(opts: {
  timed: boolean;
  showcase?: boolean;
  fighters: [FighterOptions, FighterOptions];
}): SimState {
  const r = tune.ring;
  const cy = (r.top + r.bottom) / 2;
  const cx = (r.left + r.right) / 2;
  const half = tune.match.startDistance / 2;
  const f0 = createFighter(cx - half, cy, opts.fighters[0]);
  const f1 = createFighter(cx + half, cy, opts.fighters[1]);
  // Timed rounds open with a READY... GO! countdown (frozen, no input).
  const fightStartTick = opts.timed ? Math.round((tune.match.introSec + (opts.showcase ? tune.view.fightPresentation.showcaseMs / 1000 : 0)) * TICK_RATE) : 0;
  const s: SimState = { tick: 0, fighters: [f0, f1], timed: opts.timed, hitstop: 0, fightStartTick, result: null };
  updateFacing(s);
  return s;
}

export function phaseOf(p: PunchState): Phase {
  if (p.frame < p.startup) return 'startup';
  if (p.frame < p.startup + p.sourEarly) return 'sour';
  if (p.frame < p.startup + p.sourEarly + p.sweet) return 'sweet';
  if (p.frame < activeEnd(p)) return 'sour';
  return 'recovery';
}

export function activeEnd(p: PunchState): number {
  return p.startup + p.sourEarly + p.sweet + p.sour;
}

export function punchTotal(p: PunchState): number {
  return activeEnd(p) + p.recovery;
}

// The fist travels outward during early-sour frames and sits at full reach
// from the sweet frames on, so range decides whether contact lands early
// (sour, jammed) or at full extension (sweet).
export function currentReach(p: PunchState): number {
  const reach = p.reach;
  const start = p.startReach;
  if (p.frame < p.startup) return start;
  // Full reach is only hit on the first sweet frame.
  const into = p.frame - p.startup + 1;
  if (into > p.sourEarly) return reach;
  return start + (reach - start) * (into / (p.sourEarly + 1));
}

// An exhausted fighter still dodges, at reduced efficacy: fewer invincible frames and a shorter hop.
export function dodgeEfficacy(f: Fighter): number {
  return f.exhausted ? tune.dodge.exhaustedEfficacy : 1;
}
export function dodgeIFrames(f: Fighter): number {
  return Math.round(tune.dodge.iFrames * dodgeEfficacy(f));
}

export function isVulnerable(f: Fighter): boolean {
  if (f.forceVulnerable) return true;
  // Committed to a punch: exposed during startup and recovery (including
  // whiff recovery), but not while the fist is out (active frames).
  if (f.punch) {
    const phase = phaseOf(f.punch);
    if (phase === 'startup' || phase === 'recovery') return true;
  }
  if (f.postDodgeVulnerable > 0 || f.guardPenalty > 0) return true;
  if (f.stunTimer > 0) return true;
  if (f.exhausted) return true;
  if (f.dodge && f.dodge.frame >= dodgeIFrames(f)) return true;
  return false;
}

export function stanceOf(f: Fighter): Stance {
  if (f.dodge && f.dodge.frame < dodgeIFrames(f)) return 'dodging';
  // Exhausted: guard works but has no Perfect Guard window, everything else is open.
  if (f.exhausted) return f.guarding ? 'guard' : 'vulnerable';
  if (f.guarding) return f.guardFrames < tune.guard.perfectFrames ? 'perfectGuard' : 'guard';
  return isVulnerable(f) ? 'vulnerable' : 'normal';
}

export function hurtRadius(f: Fighter): number {
  return isVulnerable(f) ? tune.body.vulnerableHurtRadius * fighterScale(f) : normalHurtRadius(f);
}

export function fatigueLevel(f: Fighter, type: PunchType): number {
  if (type === 'uppercut') return 0;
  const raw = f.fatigue[type] - tune.fatigue.freeUses;
  return Math.max(0, Math.min(punchCfg(f, type).fatigueBars, raw));
}

export function punchPoint(f: Fighter, p: PunchState): { x: number; y: number } {
  const reach = currentReach(p);
  return { x: f.x + f.fx * reach, y: f.y + f.fy * reach };
}


function canAct(f: Fighter): boolean {
  return f.punch === null && f.dodge === null;
}

// Every transition out of an active guard starts the release penalty.
function lowerGuard(f: Fighter): void {
  if (f.guarding) f.guardPenalty = tune.guard.penaltyFrames;
  f.guarding = false;
  f.guardFrames = 0;
}

function spendStamina(f: Fighter, amount: number): void {
  if (f.infiniteStamina || f.exhausted) return;
  f.stamina = Math.max(0, f.stamina - amount);
  if (f.stamina <= 0) {
    f.exhausted = true;
    f.regenWait = 0;
  }
}

function gainStamina(f: Fighter, amount: number, natural = false): void {
  if (f.exhausted && !natural) return;
  f.stamina = Math.min(maxStamina(f), f.stamina + amount);
  if (f.exhausted && f.stamina >= maxStamina(f)) f.exhausted = false;
}

function startPunch(s: SimState, idx: number, type: PunchType, events: SimEvent[]): void {
  const f = s.fighters[idx];
  const cfg = punchCfg(f, type);
  const level = fatigueLevel(f, type);
  // Per-type fatigue: each punch has its own bar count and per-bar penalty.
  const fcfg = type === 'uppercut' ? null : cfg;
  const slow = 1 + level * (fcfg ? fcfg.fatigueSpeedPerBar : 0);
  let damageMult = Math.max(tune.fatigue.minDamageMult, 1 - level * (fcfg ? fcfg.fatigueDamagePerBar : 0));
  // Post-dodge power-up: the first punch thrown in the window hits harder.
  const buffed = f.dashBuff > 0;
  if (buffed) {
    damageMult *= tune.dodge.buffDamageMult;
    f.dashBuff = 0;
  }
  let hand: 0 | 1 = 0;
  if (type === 'cross' || type === 'uppercut') hand = 1;
  if (type === 'hook') {
    hand = f.nextHookHand;
    f.nextHookHand = f.nextHookHand === 0 ? 1 : 0;
  }
  f.punch = {
    type,
    frame: 0,
    startup: Math.max(1, Math.round(cfg.startup * slow)),
    sourEarly: cfg.sourEarly,
    sweet: cfg.sweet,
    sour: cfg.sour,
    recovery: Math.max(1, Math.round(cfg.recovery * slow)),
    reach: cfg.reach,
    startReach: cfg.reach * cfg.startReachFrac,
    damageMult,
    buffed,
    resolved: false,
    connected: false,
    hand,
  };
  lowerGuard(f);
  if (type === 'uppercut') {
    f.stars = 0;
  } else {
    f.fatigue[type] += tune.fatigue.perUse;
    f.fatigueWait[type] = tune.fatigue.decayDelayFrames;
  }
  spendStamina(f, cfg.staminaCost);
  f.regenWait = tune.stamina.regenDelayFrames;
  events.push({ kind: 'throw', attacker: idx, punch: type, tired: level > 0 });
}

function startDodge(s: SimState, idx: number, input: FrameInput): void {
  const f = s.fighters[idx];
  const mag = Math.sqrt(input.mx * input.mx + input.my * input.my) / 100;
  let dx: number;
  let dy: number;
  if (mag < tune.dodge.neutralDeadzone) {
    dx = -f.fx;
    dy = -f.fy;
  } else {
    const len = mag * 100;
    dx = input.mx / len;
    dy = input.my / len;
  }
  f.dodge = { frame: 0, dx, dy };
  lowerGuard(f);
  spendStamina(f, tune.dodge.staminaCost);
  f.regenWait = tune.stamina.regenDelayFrames;
}

function requestedAction(input: FrameInput): BufferedAction | null {
  // Priority when several presses land on the same tick.
  if (input.dodge) return 'dodge';
  if (input.uppercut) return 'uppercut';
  if (input.cross) return 'cross';
  if (input.jab) return 'jab';
  if (input.hook) return 'hook';
  return null;
}

// Refused actions must not start later after stamina regeneration.
function rejectAction(f: Fighter, idx: number, action: BufferedAction, events: SimEvent[]): boolean {
  if (action === 'dodge' && f.postDodgeVulnerable > 0) {
    f.buffered = null;
    f.bufferFrames = 0;
    return true;
  }
  if (action === 'dodge' && !f.exhausted && !f.infiniteStamina && f.stamina < tune.dodge.staminaCost) {
    events.push({ kind: 'staminaRejected', fighter: idx });
    f.buffered = null;
    f.bufferFrames = 0;
    return true;
  }
  return false;
}

function tryStartAction(s: SimState, idx: number, action: BufferedAction, input: FrameInput, events: SimEvent[]): boolean {
  const f = s.fighters[idx];
  if (rejectAction(f, idx, action, events) || !canAct(f)) return false;
  if (action === 'dodge') {
    startDodge(s, idx, input);
    return true;
  }
  // Stunned fighters may move and dodge but never attack.
  if (f.stunTimer > 0) return false;
  if (action === 'uppercut' && f.stars < tune.stars.max) return false;
  startPunch(s, idx, action, events);
  return true;
}

function processInput(s: SimState, idx: number, input: FrameInput, events: SimEvent[]): void {
  const f = s.fighters[idx];
  const req = requestedAction(input);
  if (req && !rejectAction(f, idx, req, events)) {
    f.buffered = req;
    f.bufferFrames = tune.input.bufferFrames;
  }
  if (f.buffered) {
    if (tryStartAction(s, idx, f.buffered, input, events)) {
      f.buffered = null;
      f.bufferFrames = 0;
    } else if (--f.bufferFrames <= 0) {
      f.buffered = null;
    }
  }

  const canGuard = canAct(f) && f.stunTimer <= 0 && f.guardPenalty <= 0;
  if (input.guard && canGuard) {
    if (!f.guarding) {
      f.guarding = true;
      f.guardFrames = 0;
      // Every legal raise starts a fresh, tight Perfect Guard window.
    } else {
      f.guardFrames++;
    }
  } else {
    lowerGuard(f);
  }
}

function move(s: SimState, idx: number, input: FrameInput): void {
  const f = s.fighters[idx];
  const dt = 1 / TICK_RATE;
  // Being shoved: the push replaces the player's own walking for its
  // duration, so holding forward can't cancel it (dodging still works).
  const shoved = f.pushLock > 0;
  if (f.pushLock > 0) f.pushLock--;
  if (f.pushFrames > 0) {
    f.pushFrames--;
    if (!f.anchored) {
      f.x += f.pushX;
      f.y += f.pushY;
    }
  }
  if (f.dodge) {
    const speed = tune.dodge.speed * dodgeEfficacy(f);
    f.x += f.dodge.dx * speed * dt;
    f.y += f.dodge.dy * speed * dt;
    return;
  }
  if (f.anchored || shoved) return;
  let mx = input.mx / 100;
  let my = input.my / 100;
  const mag = Math.sqrt(mx * mx + my * my);
  if (mag > 1) {
    mx /= mag;
    my /= mag;
  }
  let speed = moveSpeed(f);
  if (f.punch) speed *= tune.movement.punchMoveMult;
  else if (f.guarding) speed *= tune.movement.guardMoveMult;
  if (f.stunTimer > 0) speed *= tune.movement.stunMoveMult;
  if (f.postDodgeVulnerable > 0) speed *= tune.dodge.penaltyMoveMult;
  f.x += mx * speed * dt;
  f.y += my * speed * dt;
}

function updateFacing(s: SimState): void {
  const [a, b] = s.fighters;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.0001) return;
  a.fx = dx / len;
  a.fy = dy / len;
  b.fx = -a.fx;
  b.fy = -a.fy;
}

function separateAndClamp(s: SimState): void {
  const [a, b] = s.fighters;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const min = separation(a, b);
  if (dist < min) {
    const nx = dist > 0.0001 ? dx / dist : 1;
    const ny = dist > 0.0001 ? dy / dist : 0;
    const push = min - dist;
    const aShare = a.anchored ? 0 : b.anchored ? 1 : 0.5;
    a.x -= nx * push * aShare;
    a.y -= ny * push * aShare;
    b.x += nx * push * (1 - aShare);
    b.y += ny * push * (1 - aShare);
  }
  const r = tune.ring;
  for (const f of s.fighters) {
    const pad = normalHurtRadius(f);
    f.x = Math.max(r.left + pad, Math.min(r.right - pad, f.x));
    f.y = Math.max(r.top + pad, Math.min(r.bottom - pad, f.y));
  }
}

function addStun(s: SimState, idx: number, amount: number, events: SimEvent[]): void {
  const f = s.fighters[idx];
  f.stun += amount;
  f.stunDecayWait = tune.stun.decayDelayFrames;
  if (f.stun > stunThreshold(f) && !f.stunFromMeter) {
    const overflow = f.stun - stunThreshold(f);
    f.stunTimer = tune.stun.baseFrames + Math.round(overflow * tune.stun.overflowFramesPerPoint);
    f.stunFromMeter = true;
    f.punch = null;
    lowerGuard(f);
    f.stars = 0;
    events.push({ kind: 'stunned', fighter: idx });
  }
}

function addStar(s: SimState, idx: number, events: SimEvent[]): void {
  const f = s.fighters[idx];
  if (f.stars >= tune.stars.max) return;
  f.stars++;
  if (f.stars === tune.stars.max) events.push({ kind: 'starsReady', fighter: idx });
}

interface Contact {
  attacker: number;
  sweet: boolean;
  core: boolean;
  x: number;
  y: number;
}

// Finds contacts for both fighters against pre-resolution state, so two
// punches landing on the same tick trade cleanly regardless of index order.
function detectContacts(s: SimState, events: SimEvent[]): Contact[] {
  const contacts: Contact[] = [];
  for (let i = 0; i < 2; i++) {
    const att = s.fighters[i];
    const def = s.fighters[1 - i];
    const p = att.punch;
    if (!p || p.resolved) continue;
    const phase = phaseOf(p);
    if (phase !== 'sweet' && phase !== 'sour') continue;
    const pt = punchPoint(att, p);
    const hitR = punchCfg(att, p.type).hitRadius;
    const dx = def.x - pt.x;
    const dy = def.y - pt.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > hurtRadius(def) + hitR) continue;
    if (def.dodge && def.dodge.frame < dodgeIFrames(def)) {
      p.resolved = true;
      events.push({ kind: 'dodged', attacker: i, x: pt.x, y: pt.y });
      continue;
    }
    // Touching the outer ring doesn't stop the fist: it keeps travelling and
    // the hit resolves once it reaches the core, or at full extension, or on
    // the last active frame. The resolving frame decides sweet vs sour.
    const touchingCore = dist <= coreRadius(def) + hitR;
    const fullReach = p.frame >= p.startup + p.sourEarly;
    if (!touchingCore && !fullReach) continue;
    contacts.push({
      attacker: i,
      sweet: phase === 'sweet',
      core: touchingCore,
      x: pt.x,
      y: pt.y,
    });
  }
  return contacts;
}

// Knock the defender back along the punch (hooks angle off to the side the
// hook came from), spread over hit.pushFrames ticks.
function pushBack(att: Fighter, def: Fighter, p: PunchState, dist: number): void {
  if (dist <= 0) return;
  let dx = att.fx;
  let dy = att.fy;
  if (p.type === 'hook') {
    const side = p.hand === 0 ? 1 : -1;
    dx -= att.fy * side * 0.5;
    dy += att.fx * side * 0.5;
    const len = Math.sqrt(dx * dx + dy * dy);
    dx /= len;
    dy /= len;
  }
  const frames = Math.max(1, tune.hit.pushFrames);
  def.pushX = (dx * dist) / frames;
  def.pushY = (dy * dist) / frames;
  def.pushFrames = frames;
  def.pushLock = Math.max(def.pushLock, tune.hit.pushLockFrames);
}

function resolveContact(s: SimState, c: Contact, stances: Stance[], defStartup: boolean[], defRecovery: boolean[], emergencyAttack: boolean[], events: SimEvent[]): void {
  const att = s.fighters[c.attacker];
  const defIdx = 1 - c.attacker;
  const def = s.fighters[defIdx];
  const p = att.punch;
  if (!p) return;
  p.resolved = true;
  const cfg = punchCfg(att, p.type);
  const damageMult = p.damageMult * (emergencyAttack[c.attacker] ? tune.stamina.emergencyDamageMult : 1);

  let stance = stances[defIdx];
  // Uppercut ignores a normal High Guard (taken as a normal hit) but a
  // Perfect Guard stops it. It can also be dodged (detectContacts).
  if (p.type === 'uppercut' && stance === 'guard') {
    stance = 'normal';
  }
  // A hook wraps around a Perfect Guard just as it does a High Guard: it
  // resolves as an ordinary block (chip damage, no attacker stun).
  if (p.type === 'hook' && stance === 'perfectGuard') {
    stance = 'guard';
  }

  if (stance === 'perfectGuard') {
    gainStamina(def, tune.guard.perfectGuardStaminaGain);
    att.punch = null;
    att.stars = 0;
    if (att.stunTimer < tune.guard.perfectGuardAttackerStunFrames) {
      att.stunTimer = tune.guard.perfectGuardAttackerStunFrames;
    }
    addStun(s, c.attacker, tune.guard.perfectGuardStunBuild, events);
    events.push({ kind: 'perfectGuard', attacker: c.attacker, x: c.x, y: c.y });
    return;
  }

  if (stance === 'guard') {
    if (c.sweet) spendStamina(def, cfg.staminaDamage);
    spendStamina(att, tune.hit.attackerStaminaPenalty);
    // Blocked is contact, not a whiff: the star chain is kept.
    p.connected = true;
    // Hooks wrap around a High Guard: chip damage (anti-turtle). An exhausted
    // guard is chipped by every punch that it can block.
    let chip = 0;
    if (p.type === 'hook' || def.exhausted) {
      const full = cfg.damage * damageMult;
      const share = def.exhausted ? tune.guard.exhaustedChipMult : tune.punches.hook.guardChipMult;
      chip = (c.sweet ? full : full * tune.hit.reducedDamageMult) * share;
      def.health = Math.max(0, def.health - chip);
      if (chip > 0) def.lastBlow = { punch: p.type, sweet: c.sweet, chip: true, dx: att.fx, dy: att.fy };
    }
    pushBack(att, def, p, cfg.pushBlock);
    events.push({ kind: 'block', attacker: c.attacker, x: c.x, y: c.y, sweet: c.sweet, chip });
    return;
  }

  // The core is the face: in Normal stance a hit that reaches it resolves
  // on the Vulnerable row (full damage on sweet); a hit that only clips the
  // outer ring (arms/body) resolves on the Normal row.
  // Uppercut ignores the outer ring as it ignores guard: always the Vulnerable row.
  const row: 'normal' | 'vulnerable' = stance === 'normal' && !c.core && p.type !== 'uppercut' ? 'normal' : 'vulnerable';
  const baseDamage =
    p.type === 'uppercut'
      ? tune.punches.cross.damage * tune.punches.uppercut.crossDamageMult * cfg.damage
      : cfg.damage;
  const full = baseDamage * damageMult;
  const reduced = full * tune.hit.reducedDamageMult;

  // Only face hits (the full-damage row) cost the defender stamina; body
  // hits leave it alone so stamina stays the attacker's resource.
  let damage = 0;
  if (row === 'normal') {
    if (c.sweet) damage = reduced;
    else spendStamina(att, tune.hit.attackerStaminaPenalty);
  } else {
    spendStamina(def, cfg.staminaDamage);
    damage = c.sweet ? full : reduced;
  }

  // Counter (x1.5 damage and stun, double hit-stop, bonus stars): a Cross or
  // Hook that catches a punch in startup, or any punch that catches a
  // defender in a guard-release or dodge penalty (a punish).
  const punished = def.guardPenalty > 0 || def.postDodgeVulnerable > 0 || (!!def.dodge && def.dodge.frame >= dodgeIFrames(def));
  // Each punch says whether it counters a defender caught in startup and/or recovery.
  const flags = tune.punches[p.type];
  const catches = (flags.counterStartup > 0 && defStartup[defIdx]) || (flags.counterRecovery > 0 && defRecovery[defIdx]);
  const counter = damage > 0 && (catches || punished);
  if (counter) damage *= tune.hit.counterDamageMult;

  p.connected = true;
  pushBack(att, def, p, cfg.pushHit);
  if (damage > 0) {
    def.health = Math.max(0, def.health - damage);
    def.lastBlow = { punch: p.type, sweet: c.sweet, chip: false, dx: att.fx, dy: att.fy };
    // Only a sweet hit breaks the defender's star chain; sour keeps it.
    if (c.sweet) def.stars = 0;
    def.framesSinceHit = 0;
    // Any damaging hit interrupts a punch still in startup (jab included).
    if (def.punch && phaseOf(def.punch) === 'startup') def.punch = null;
    const stunAmount = cfg.stunBuild * (c.sweet ? 1 : tune.hit.sourStunMult) * (counter ? tune.hit.counterDamageMult : 1);
    addStun(s, defIdx, stunAmount, events);
    const stop = tune.hit.hitstopFrames * (counter ? 2 : 1);
    if (stop > s.hitstop) s.hitstop = stop;
  }
  // Stars: a counter gives stars.counterGain, a sweet hit +1 (not stacked).
  // Uppercut consumes stars rather than building them.
  if (p.type !== 'uppercut') {
    const gain = counter ? tune.stars.counterGain : c.sweet ? 1 : 0;
    for (let i = 0; i < gain; i++) addStar(s, c.attacker, events);
  }

  events.push({
    kind: 'hit',
    attacker: c.attacker,
    x: c.x,
    y: c.y,
    punch: p.type,
    sweet: c.sweet,
    counter,
    row,
    damage,
    buffed: p.buffed,
  });
}

function advanceTimers(s: SimState, idx: number, input: FrameInput, events: SimEvent[]): void {
  const f = s.fighters[idx];

  if (f.punch) {
    const p = f.punch;
    p.frame++;
    if (p.frame === activeEnd(p) && !p.connected) {
      // Whiffing keeps the star chain (it used to reset it).
      // Whiff punish window, on top of normal recovery.
      p.recovery += tune.punches[p.type].whiffRecovery;
      events.push({ kind: 'whiff', attacker: idx, punch: p.type });
    }
    if (p.frame >= punchTotal(p)) f.punch = null;
  }

  if (f.guardPenalty > 0) f.guardPenalty--;
  if (f.dashBuff > 0 && !f.dodge) f.dashBuff--;

  if (f.dodge) {
    f.dodge.frame++;
    if (f.dodge.frame >= tune.dodge.frames) {
      f.dodge = null;
      const mult = f.stunTimer > 0 ? tune.dodge.stunnedVulnerableMult : 1;
      f.postDodgeVulnerable = Math.round(tune.dodge.vulnerableFrames * mult);
      f.dashBuff = tune.dodge.buffWindowFrames;
    }
  } else if (f.postDodgeVulnerable > 0) {
    f.postDodgeVulnerable--;
  }

  if (f.stunTimer > 0) {
    f.stunTimer--;
    if (f.stunTimer === 0 && f.stunFromMeter) {
      f.stunFromMeter = false;
      f.stun = 0;
    }
  }

  if (f.stunDecayWait > 0) f.stunDecayWait--;
  else if (!f.stunFromMeter) f.stun = Math.max(0, f.stun - tune.stun.decayPerSec / TICK_RATE);


  // Decay pause: a type's fatigue only wears off after a spell of not
  // throwing it, so repeating a punch always builds up.
  for (const t of FATIGUED_PUNCHES) {
    if (f.fatigueWait[t] > 0) f.fatigueWait[t]--;
    else f.fatigue[t] = Math.max(0, f.fatigue[t] - tune.fatigue.decayPerSec / TICK_RATE);
  }

  // Stamina: guard drains; otherwise regen after a short delay since the
  // last spend, fastest with no input at all.
  if (f.infiniteStamina) {
    f.stamina = maxStamina(f);
    f.exhausted = false;
  } else if (f.exhausted) {
    // Protected, continuous recovery at the normal standing-still rate, even while
    // punching/stunned. Only natural recovery changes this meter until full.
    f.regenWait = 0;
    gainStamina(f, tune.stamina.regenIdlePerSec * regenMult(f) / TICK_RATE, true);
  } else if (f.guarding) {
    spendStamina(f, tune.guard.staminaDrainPerSec / TICK_RATE);
  } else if (f.regenWait > 0) {
    f.regenWait--;
  } else if (!f.punch && !f.dodge) {
    const noInput =
      input.mx === 0 && input.my === 0 && !input.jab && !input.cross && !input.hook && !input.uppercut && !input.dodge && !input.guard;
    let rate = noInput ? tune.stamina.regenIdlePerSec : tune.stamina.regenActivePerSec;
    rate *= regenMult(f);
    gainStamina(f, rate / TICK_RATE);
  }

  f.framesSinceHit++;
}

// Uppercut always sends them flying; a clean (sweet, unblocked) Cross or
// Hook does too. Jabs, chip damage and sour hits drop them where they stand.
export function koStyle(b: LastBlow): KoStyle {
  if (b.punch === 'uppercut') return 'fly';
  if ((b.punch === 'cross' || b.punch === 'hook') && b.sweet && !b.chip) return 'fly';
  return 'drop';
}

function checkMatchEnd(s: SimState, events: SimEvent[]): void {
  if (s.result) return;
  const [a, b] = s.fighters;
  if (a.health <= 0 || b.health <= 0) {
    const loser = a.health <= 0 && b.health <= 0 ? -1 : a.health <= 0 ? 0 : 1;
    s.result = { winner: loser === -1 ? null : 1 - loser, reason: 'ko' };
    const blow = loser === -1 ? null : s.fighters[loser].lastBlow;
    if (blow) s.result.ko = { loser, style: koStyle(blow), dx: blow.dx, dy: blow.dy };
    if (loser !== -1) events.push({ kind: 'ko', loser });
    else events.push({ kind: 'timeUp', winner: null });
    return;
  }
  if (s.timed && s.tick - s.fightStartTick >= tune.match.durationSec * TICK_RATE) {
    // Higher health percentage wins; a tie is a draw.
    const winner = a.health === b.health ? null : a.health > b.health ? 0 : 1;
    s.result = { winner, reason: 'time' };
    events.push({ kind: 'timeUp', winner });
  }
}

export function remainingSeconds(s: SimState): number {
  const elapsed = Math.max(0, s.tick - s.fightStartTick) / TICK_RATE;
  return Math.max(0, Math.ceil(tune.match.durationSec - elapsed));
}

// Advances the simulation one tick. Mutates `s` in place and returns the
// events raised this tick for the renderer (sparks, sounds, labels).
export function step(s: SimState, inputs: [FrameInput, FrameInput], finishMatch = true): SimEvent[] {
  const events: SimEvent[] = [];
  if (s.result) return events;

  // READY... GO! countdown: nothing moves; the tick still advances (the netcode
  // keys inputs on it) and the round timer starts at GO.
  if (s.tick < s.fightStartTick) {
    const showcaseTicks = Math.max(0, s.fightStartTick - Math.round(tune.match.introSec * TICK_RATE));
    if (s.tick === showcaseTicks) events.push({ kind: 'ready' });
    s.tick++;
    if (s.tick === s.fightStartTick) events.push({ kind: 'go' });
    return events;
  }

  for (const f of s.fighters) {
    if (!f.infiniteStamina && f.stamina <= 0) {
      f.exhausted = true;
      f.regenWait = 0;
    }
  }

  // Hit-stop: the fight freezes, but presses are still buffered and the tick
  // (which the netcode keys inputs on) still advances.
  if (s.hitstop > 0) {
    s.hitstop--;
    for (let i = 0; i < 2; i++) {
      const f = s.fighters[i];
      if (f.exhausted) gainStamina(f, tune.stamina.regenIdlePerSec * regenMult(f) / TICK_RATE, true);
      const req = requestedAction(inputs[i]);
      if (req && !rejectAction(s.fighters[i], i, req, events)) {
        s.fighters[i].buffered = req;
        s.fighters[i].bufferFrames = tune.input.bufferFrames;
      }
    }
    s.tick++;
    return events;
  }

  processInput(s, 0, inputs[0], events);
  processInput(s, 1, inputs[1], events);
  move(s, 0, inputs[0]);
  move(s, 1, inputs[1]);
  separateAndClamp(s);
  updateFacing(s);

  const stances: Stance[] = [stanceOf(s.fighters[0]), stanceOf(s.fighters[1])];
  const inStartup = s.fighters.map((f) => f.punch !== null && phaseOf(f.punch) === 'startup');
  const inRecovery = s.fighters.map((f) => f.punch !== null && phaseOf(f.punch) === 'recovery');
  const emergencyAttack = s.fighters.map((f) => f.exhausted);
  const contacts = detectContacts(s, events);
  for (const c of contacts) resolveContact(s, c, stances, inStartup, inRecovery, emergencyAttack, events);

  advanceTimers(s, 0, inputs[0], events);
  advanceTimers(s, 1, inputs[1], events);

  s.tick++;
  // Training opts out: HP can stay at zero while hits and input continue.
  // Default behavior remains identical for matches and rollback callers.
  if (finishMatch) checkMatchEnd(s, events);
  return events;
}
