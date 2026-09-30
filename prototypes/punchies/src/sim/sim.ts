import { tune, TICK_RATE } from './tune';
import type {
  BufferedAction,
  Fighter,
  FrameInput,
  Phase,
  PunchState,
  PunchType,
  SimEvent,
  SimState,
  Stance,
} from './types';
import { FATIGUED_PUNCHES } from './types';

// Deterministic fight simulation, stepped at a fixed 60 Hz. Only uses
// + - * / and Math.sqrt/round/min/max/abs (all exactly specified by IEEE
// 754 / ECMAScript), never trig, so both lockstep peers stay in sync.

export interface FighterOptions {
  anchored?: boolean;
  infiniteStamina?: boolean;
  forceVulnerable?: boolean;
}

function createFighter(x: number, y: number, opts: FighterOptions): Fighter {
  return {
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
    punch: null,
    dodge: null,
    postDodgeVulnerable: 0,
    stunTimer: 0,
    stunFromMeter: false,
    guarding: false,
    guardFrames: 0,
    guardDownFrames: 9999,
    perfectEligible: false,
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
  };
}

export function createSimState(opts: {
  timed: boolean;
  fighters: [FighterOptions, FighterOptions];
}): SimState {
  const r = tune.ring;
  const cy = (r.top + r.bottom) / 2;
  const cx = (r.left + r.right) / 2;
  const half = tune.match.startDistance / 2;
  const f0 = createFighter(cx - half, cy, opts.fighters[0]);
  const f1 = createFighter(cx + half, cy, opts.fighters[1]);
  const s: SimState = { tick: 0, fighters: [f0, f1], timed: opts.timed, hitstop: 0, result: null };
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

function punchTotal(p: PunchState): number {
  return activeEnd(p) + p.recovery;
}

// The fist travels outward during early-sour frames and sits at full reach
// from the sweet frames on, so range decides whether contact lands early
// (sour, jammed) or at full extension (sweet).
export function currentReach(p: PunchState): number {
  const reach = tune.punches[p.type].reach;
  const start = reach * tune.punches[p.type].startReachFrac;
  if (p.frame < p.startup) return start;
  // Full reach is only hit on the first sweet frame.
  const into = p.frame - p.startup + 1;
  if (into > p.sourEarly) return reach;
  return start + (reach - start) * (into / (p.sourEarly + 1));
}

export function isVulnerable(f: Fighter): boolean {
  if (f.forceVulnerable) return true;
  // Committed to a punch: exposed during startup and recovery (including
  // whiff recovery), but not while the fist is out (active frames).
  if (f.punch) {
    const phase = phaseOf(f.punch);
    if (phase === 'startup' || phase === 'recovery') return true;
  }
  if (f.postDodgeVulnerable > 0) return true;
  if (f.stunTimer > 0) return true;
  if (f.exhausted) return true;
  if (f.dodge && f.dodge.frame >= tune.dodge.iFrames) return true;
  return false;
}

export function stanceOf(f: Fighter): Stance {
  if (f.dodge && f.dodge.frame < tune.dodge.iFrames) return 'dodging';
  if (f.guarding) return f.perfectEligible && f.guardFrames < tune.guard.perfectFrames ? 'perfectGuard' : 'guard';
  return isVulnerable(f) ? 'vulnerable' : 'normal';
}

export function hurtRadius(f: Fighter): number {
  return isVulnerable(f) ? tune.body.vulnerableHurtRadius : tune.body.hurtRadius;
}

export function fatigueLevel(f: Fighter, type: PunchType): number {
  if (type === 'uppercut') return 0;
  const raw = f.fatigue[type] - tune.fatigue.freeUses;
  return Math.max(0, Math.min(tune.fatigue.maxLevel, raw));
}

export function punchPoint(f: Fighter, p: PunchState): { x: number; y: number } {
  const reach = currentReach(p);
  return { x: f.x + f.fx * reach, y: f.y + f.fy * reach };
}


function canAct(f: Fighter): boolean {
  return f.punch === null && f.dodge === null;
}

function spendStamina(f: Fighter, amount: number): void {
  if (f.infiniteStamina) return;
  f.stamina = Math.max(0, f.stamina - amount);
  if (f.stamina <= 0) {
    f.exhausted = true;
    f.guarding = false;
  }
}

function gainStamina(f: Fighter, amount: number): void {
  f.stamina = Math.min(tune.stamina.max, f.stamina + amount);
  if (f.exhausted && f.stamina >= tune.stamina.exhaustRecoverAt) f.exhausted = false;
}

function startPunch(s: SimState, idx: number, type: PunchType, events: SimEvent[]): void {
  const f = s.fighters[idx];
  const cfg = tune.punches[type];
  const level = fatigueLevel(f, type);
  const slow = 1 + level * tune.fatigue.speedPerLevel;
  let damageMult = Math.max(tune.fatigue.minDamageMult, 1 - level * tune.fatigue.damagePerLevel);
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
    damageMult,
    buffed,
    resolved: false,
    connected: false,
    hand,
  };
  f.guarding = false;
  f.guardFrames = 0;
  if (type === 'uppercut') {
    f.stars = 0;
  } else {
    f.fatigue[type] += tune.fatigue.perUse;
  }
  spendStamina(f, cfg.staminaCost);
  f.regenWait = tune.stamina.regenDelayFrames;
  events.push({ kind: 'throw', attacker: idx, punch: type });
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
  f.guarding = false;
  f.guardFrames = 0;
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

function tryStartAction(s: SimState, idx: number, action: BufferedAction, input: FrameInput, events: SimEvent[]): boolean {
  const f = s.fighters[idx];
  if (!canAct(f)) return false;
  if (action === 'dodge') {
    if (f.stamina <= 0 && !f.infiniteStamina) return false;
    startDodge(s, idx, input);
    return true;
  }
  // Stunned fighters may move and dodge but never attack.
  if (f.stunTimer > 0) return false;
  if (f.stamina <= 0 && !f.infiniteStamina) return false;
  if (action === 'uppercut' && f.stars < tune.stars.max) return false;
  startPunch(s, idx, action, events);
  return true;
}

function processInput(s: SimState, idx: number, input: FrameInput, events: SimEvent[]): void {
  const f = s.fighters[idx];

  const req = requestedAction(input);
  if (req) {
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

  const canGuard = canAct(f) && f.stunTimer <= 0 && !f.exhausted;
  if (input.guard && canGuard) {
    if (!f.guarding) {
      f.guarding = true;
      f.guardFrames = 0;
      // Anti-mash: a Perfect Guard window only opens if guard was down long
      // enough before this raise.
      f.perfectEligible = f.guardDownFrames >= tune.guard.perfectCooldownFrames;
      f.guardDownFrames = 0;
    } else {
      f.guardFrames++;
    }
  } else {
    f.guarding = false;
    f.guardFrames = 0;
    f.guardDownFrames++;
  }
}

function move(s: SimState, idx: number, input: FrameInput): void {
  const f = s.fighters[idx];
  const dt = 1 / TICK_RATE;
  if (f.dodge) {
    f.x += f.dodge.dx * tune.dodge.speed * dt;
    f.y += f.dodge.dy * tune.dodge.speed * dt;
    return;
  }
  if (f.anchored) return;
  let mx = input.mx / 100;
  let my = input.my / 100;
  const mag = Math.sqrt(mx * mx + my * my);
  if (mag > 1) {
    mx /= mag;
    my /= mag;
  }
  let speed = tune.movement.speed;
  if (f.punch) speed *= tune.movement.punchMoveMult;
  else if (f.guarding) speed *= tune.movement.guardMoveMult;
  if (f.stunTimer > 0) speed *= tune.movement.stunMoveMult;
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
  const min = tune.movement.minSeparation;
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
  const pad = tune.body.hurtRadius;
  for (const f of s.fighters) {
    f.x = Math.max(r.left + pad, Math.min(r.right - pad, f.x));
    f.y = Math.max(r.top + pad, Math.min(r.bottom - pad, f.y));
  }
}

function addStun(s: SimState, idx: number, amount: number, events: SimEvent[]): void {
  const f = s.fighters[idx];
  f.stun += amount;
  f.stunDecayWait = tune.stun.decayDelayFrames;
  if (f.stun > tune.stun.threshold && !f.stunFromMeter) {
    const overflow = f.stun - tune.stun.threshold;
    f.stunTimer = tune.stun.baseFrames + Math.round(overflow * tune.stun.overflowFramesPerPoint);
    f.stunFromMeter = true;
    f.punch = null;
    f.guarding = false;
    f.guardFrames = 0;
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
    const hitR = tune.punches[p.type].hitRadius;
    const dx = def.x - pt.x;
    const dy = def.y - pt.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > hurtRadius(def) + hitR) continue;
    if (def.dodge && def.dodge.frame < tune.dodge.iFrames) {
      p.resolved = true;
      events.push({ kind: 'dodged', attacker: i, x: pt.x, y: pt.y });
      continue;
    }
    // Touching the outer ring doesn't stop the fist: it keeps travelling and
    // the hit resolves once it reaches the core, or at full extension, or on
    // the last active frame. The resolving frame decides sweet vs sour.
    const touchingCore = dist <= tune.body.coreRadius + hitR;
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

function resolveContact(s: SimState, c: Contact, stances: Stance[], defStartup: boolean[], events: SimEvent[]): void {
  const att = s.fighters[c.attacker];
  const defIdx = 1 - c.attacker;
  const def = s.fighters[defIdx];
  const p = att.punch;
  if (!p) return;
  p.resolved = true;
  const cfg = tune.punches[p.type];

  let stance = stances[defIdx];
  // Uppercut cannot be blocked or Perfect Guarded (it can be dodged, handled
  // in detectContacts). A guarding defender just takes it as a normal hit.
  if (p.type === 'uppercut' && (stance === 'guard' || stance === 'perfectGuard')) {
    stance = 'normal';
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
    att.stars = 0;
    // Blocked is contact, not a whiff (the chain already broke above).
    p.connected = true;
    // Hooks wrap around a High Guard: chip damage (anti-turtle).
    let chip = 0;
    if (p.type === 'hook') {
      const full = tune.punches.hook.damage * p.damageMult;
      chip = (c.sweet ? full : full * tune.hit.reducedDamageMult) * tune.punches.hook.guardChipMult;
      def.health = Math.max(0, def.health - chip);
    }
    events.push({ kind: 'block', attacker: c.attacker, x: c.x, y: c.y, sweet: c.sweet, chip });
    return;
  }

  // The core is the face: in Normal stance a hit that reaches it resolves
  // on the Vulnerable row (full damage on sweet); a hit that only clips the
  // outer ring (arms/body) resolves on the Normal row.
  const row: 'normal' | 'vulnerable' = stance === 'normal' && !c.core ? 'normal' : 'vulnerable';
  const baseDamage =
    p.type === 'uppercut'
      ? tune.punches.cross.damage * tune.punches.uppercut.crossDamageMult
      : tune.punches[p.type].damage;
  const full = baseDamage * p.damageMult;
  const reduced = full * tune.hit.reducedDamageMult;

  let damage = 0;
  if (row === 'normal') {
    spendStamina(def, cfg.staminaDamage);
    if (c.sweet) damage = reduced;
    else spendStamina(att, tune.hit.attackerStaminaPenalty);
  } else {
    spendStamina(def, cfg.staminaDamage);
    damage = c.sweet ? full : reduced;
  }

  const counter = (p.type === 'cross' || p.type === 'hook') && defStartup[defIdx] && damage > 0;
  if (counter) damage *= tune.hit.counterDamageMult;

  p.connected = true;
  if (damage > 0) {
    def.health = Math.max(0, def.health - damage);
    def.stars = 0;
    def.framesSinceHit = 0;
    // Any damaging hit interrupts a punch still in startup (jab included).
    if (def.punch && phaseOf(def.punch) === 'startup') def.punch = null;
    const stunAmount = cfg.stunBuild * (c.sweet ? 1 : tune.hit.sourStunMult) * (counter ? tune.hit.counterDamageMult : 1);
    addStun(s, defIdx, stunAmount, events);
    const stop = tune.hit.hitstopFrames * (counter ? 2 : 1);
    if (stop > s.hitstop) s.hitstop = stop;
  }
  // +1 star for a sweet hit or a counter, never stacked. Uppercut consumes
  // stars rather than building them.
  if (p.type !== 'uppercut' && (c.sweet || counter)) addStar(s, c.attacker, events);

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
      f.stars = 0;
      // Whiff punish window, on top of normal recovery.
      p.recovery += tune.punches[p.type].whiffRecovery;
      events.push({ kind: 'whiff', attacker: idx, punch: p.type });
    }
    if (p.frame >= punchTotal(p)) f.punch = null;
  }

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

  if (f.dashBuff > 0 && !f.dodge) f.dashBuff--;

  for (const t of FATIGUED_PUNCHES) {
    f.fatigue[t] = Math.max(0, f.fatigue[t] - tune.fatigue.decayPerSec / TICK_RATE);
  }

  // Stamina: guard drains; otherwise regen after a short delay since the
  // last spend, fastest with no input at all.
  if (f.infiniteStamina) {
    f.stamina = tune.stamina.max;
    f.exhausted = false;
  } else if (f.guarding) {
    spendStamina(f, tune.guard.staminaDrainPerSec / TICK_RATE);
  } else if (f.regenWait > 0) {
    f.regenWait--;
  } else if (!f.punch && !f.dodge) {
    const noInput =
      input.mx === 0 && input.my === 0 && !input.jab && !input.cross && !input.hook && !input.uppercut && !input.dodge && !input.guard;
    let rate = noInput ? tune.stamina.regenIdlePerSec : tune.stamina.regenActivePerSec;
    // Exhausted (hit 0, Vulnerable): much slower climb back to exhaustRecoverAt.
    if (f.exhausted) rate *= tune.stamina.exhaustedRegenMult;
    gainStamina(f, rate / TICK_RATE);
  }

  f.framesSinceHit++;
}

function checkMatchEnd(s: SimState, events: SimEvent[]): void {
  if (s.result) return;
  const [a, b] = s.fighters;
  if (a.health <= 0 || b.health <= 0) {
    const loser = a.health <= 0 && b.health <= 0 ? -1 : a.health <= 0 ? 0 : 1;
    s.result = { winner: loser === -1 ? null : 1 - loser, reason: 'ko' };
    if (loser !== -1) events.push({ kind: 'ko', loser });
    else events.push({ kind: 'timeUp', winner: null });
    return;
  }
  if (s.timed && s.tick >= tune.match.durationSec * TICK_RATE) {
    // Higher health percentage wins; a tie is a draw.
    const winner = a.health === b.health ? null : a.health > b.health ? 0 : 1;
    s.result = { winner, reason: 'time' };
    events.push({ kind: 'timeUp', winner });
  }
}

export function remainingSeconds(s: SimState): number {
  return Math.max(0, Math.ceil(tune.match.durationSec - s.tick / TICK_RATE));
}

// Advances the simulation one tick. Mutates `s` in place and returns the
// events raised this tick for the renderer (sparks, sounds, labels).
export function step(s: SimState, inputs: [FrameInput, FrameInput]): SimEvent[] {
  const events: SimEvent[] = [];
  if (s.result) return events;

  // Hit-stop: the fight freezes, but presses are still buffered and the tick
  // (which lockstep keys inputs on) still advances.
  if (s.hitstop > 0) {
    s.hitstop--;
    for (let i = 0; i < 2; i++) {
      const req = requestedAction(inputs[i]);
      if (req) {
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
  const contacts = detectContacts(s, events);
  for (const c of contacts) resolveContact(s, c, stances, inStartup, events);

  advanceTimers(s, 0, inputs[0], events);
  advanceTimers(s, 1, inputs[1], events);

  s.tick++;
  checkMatchEnd(s, events);
  return events;
}
