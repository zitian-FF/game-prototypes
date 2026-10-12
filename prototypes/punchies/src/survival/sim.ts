import config from './config.json';
import { tune, TICK_RATE } from '../sim/tune';
import {superBalanceConfig} from '../sim/super';
import { fightCueTiming } from '../sim/fightCue';
import { CHARACTER_IDS, maxHealth, maxStamina, punchCfg, regenMult } from '../sim/character';
import { punchFist } from '../sim/fistPath';
import { fighterScale, normalHurtRadius, separation } from '../sim/geometry';
import { EasyAI } from '../sim/ai';
import { arenaCombat as combat, phaseOf, punchTotal, stanceOf } from '../sim/sim';
import { NEUTRAL_INPUT, type Fighter, type FrameInput, type PunchState, type SimEvent, type SimState } from '../sim/types';
import type { RunOptions, SurvivalEnemy, SurvivalEvent, SurvivalRun } from './types';

export { default as survivalConfig } from './config.json';

export function survivalBalanceVersion(): string {
  let hash = 2166136261;
  for (const ch of JSON.stringify([tune, config,superBalanceConfig])) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619) >>> 0;
  return `survival-v2-${hash.toString(16)}`;
}
function random(r: SurvivalRun): number {
  r.rngState = (r.rngState + 0x6d2b79f5) >>> 0;
  let t = r.rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function pair(r: SurvivalRun, enemy: Fighter): SimState {
  return { tick: r.tick, fighters: [r.player, enemy], timed: false, hitstop: r.hitstop, fightStartTick: 0, result: null };
}
function face(f: Fighter, other: Fighter): void {
  if (f.punch || f.dodge) return;
  const dx = other.x - f.x, dy = other.y - f.y, d = Math.hypot(dx, dy);
  if (d > 0) { f.fx = dx / d; f.fy = dy / d; }
}
export const survivalPunchPoint = (f: Fighter,p: PunchState) => punchFist(f,p,fighterScale(f));
export function closestEnemy(r: SurvivalRun): SurvivalEnemy | undefined {
  let best: SurvivalEnemy | undefined, distance = Infinity;
  for (const e of r.enemies) {
    if (e.fighter.health <= 0) continue;
    const d = (e.fighter.x - r.player.x) ** 2 + (e.fighter.y - r.player.y) ** 2;
    if (d < distance) { best = e; distance = d; }
  }
  return best;
}
function clamp(f: Fighter): void {
  const radius = normalHurtRadius(f), ring = tune.ring;
  f.x = Math.max(ring.left + radius, Math.min(ring.right - radius, f.x));
  f.y = Math.max(ring.top + radius, Math.min(ring.bottom - radius, f.y));
}
function separate(r: SurvivalRun): void {
  const all = [r.player, ...r.enemies.map(e => e.fighter)];
  for (let pass = 0; pass < config.separationPasses; pass++) {
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
      const a = all[i], b = all[j], dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy), min = separation(a, b);
      if (d >= min) continue;
      const nx = d > 0 ? dx / d : 1, ny = d > 0 ? dy / d : 0, push = (min - d) / 2;
      a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
    }
    all.forEach(clamp);
  }
}
function spawn(r: SurvivalRun, kind: 'boss' | 'zombie', events: SurvivalEvent[]): boolean {
  if (r.enemies.length >= config.maxActiveEnemies) return false;
  if(kind==='zombie'&&r.bossChar&&r.enemies.filter(e=>e.kind==='zombie'&&e.fighter.health>0).length>=config.bossMaxZombies)return false;
  const char = kind === 'boss' ? r.bossChar! : 'marco';
  const f = combat.createFighter(0, 0, { char });
  const inset = normalHurtRadius(f) + config.spawnEdgeInset, ring = tune.ring;
  let placed = false;
  for (let attempt = 0; attempt < config.spawnAttempts; attempt++) {
    const edge = Math.floor(random(r) * 4), t = random(r);
    f.x = ring.left + inset + t * (ring.right - ring.left - inset * 2);
    f.y = ring.top + inset + t * (ring.bottom - ring.top - inset * 2);
    if (edge === 0) f.y = ring.top + inset;
    if (edge === 1) f.x = ring.right - inset;
    if (edge === 2) f.y = ring.bottom - inset;
    if (edge === 3) f.x = ring.left + inset;
    if (Math.hypot(f.x - r.player.x, f.y - r.player.y) < config.spawnPlayerDistance) continue;
    if (r.enemies.some(e => Math.hypot(e.fighter.x - f.x, e.fighter.y - f.y) < separation(e.fighter, f))) continue;
    placed = true; break;
  }
  if (!placed) return false; // Defer, never spawn on top of a fighter.
  const hp = kind === 'zombie'
    ? config.zombieMinHp + Math.floor(random(r) * (config.zombieMaxHp - config.zombieMinHp + 1))
    : Math.min(config.bossHpCap,config.bossHpBase+Math.max(0,Math.floor(r.wave/config.bossEveryWaves)-1)*config.bossHpGrowth)*maxHealth(f)/config.bossRosterAverageHp;
  f.health = hp;
  const enemy: SurvivalEnemy = {
    id: `enemy-${r.nextEnemyId++}`, kind, visualId: kind === 'zombie' ? 'zombie' : char,
    fighter: f, attackWait: Math.floor(random(r) * waveProgression(r.wave).attackCooldownFrames), maxHealth: hp,
    speedRatio: kind === 'boss' ? 1 : waveProgression(r.wave).speedRatio,
  };
  r.enemies.push(enemy); face(f, r.player);
  if (kind === 'boss') { r.bossSpawned = true; r.bossAI = new EasyAI(1, r.seed ^ r.wave).snapshot(); }
  events.push({ kind: 'spawn', enemyId: enemy.id, enemyKind: kind });
  return true;
}
function beginWave(r: SurvivalRun): SurvivalEvent[] {
  r.waveStartTick=r.tick; r.fightStartTick=r.tick+Math.max(Math.round(tune.match.introSec*TICK_RATE),fightCueTiming().entranceTicks+1);
  r.status = 'active'; r.remainingTicks = config.waveSeconds * TICK_RATE;
  r.waveKills = 0; r.waveZombieKills = 0; r.healing = 0; r.enemies = [];
  r.bossSpawned = false; r.bossAI = null; r.bossChar = r.wave % config.bossEveryWaves === 0 ? CHARACTER_IDS[Math.floor(random(r) * CHARACTER_IDS.length)] : null;
  if(r.bossChar)r.remainingTicks=0;
  r.spawnWait = spawnInterval(r); r.swingHits = []; r.hitstop = 0;
  r.bossPending=null;r.lastEnemyAttackTick=r.tick-config.attackStartGapFrames;
  const events: SurvivalEvent[] = [];
  if (r.bossChar) spawn(r, 'boss', events);
  for (let i = 0; i < (r.bossChar?config.bossInitialZombies:config.initialZombies); i++) spawn(r, 'zombie', events);
  return events;
}
function spawnInterval(r: SurvivalRun): number {
  if(r.bossChar)return config.bossSpawnIntervalFrames;
  return Math.max(config.minSpawnIntervalFrames, config.spawnIntervalFrames - (r.wave - 1) * config.spawnIntervalReductionPerWave);
}
export function createRun(opts: RunOptions): SurvivalRun {
  const player = combat.createFighter((tune.ring.left + tune.ring.right) / 2, (tune.ring.top + tune.ring.bottom) / 2, { char: opts.fighter });
  const r: SurvivalRun = {
    ...opts, balanceVersion: opts.balanceVersion ?? survivalBalanceVersion(), seed: opts.seed >>> 0, rngState: opts.seed >>> 0,
    tick: 0, waveStartTick:0, fightStartTick:0, wave: 1, clearedWave: 0, remainingTicks: 0, waveKills: 0, waveZombieKills: 0, totalKills: 0,
    totalZombieKills:0, damageDealt:0, damageReceived:0, status: 'active', endReason: null, player, enemies: [], bossChar: null, healing: 0, hitstop: 0,
    spawnWait: 0, nextEnemyId: 1, swingHits: [], bossSpawned: false, bossAI: null,lastEnemyAttackTick:0,bossPending:null,
  };
  beginWave(r); return r;
}
export function startNextWave(r: SurvivalRun): SurvivalEvent[] {
  if (r.status !== 'intermission') return [];
  r.wave++; return beginWave(r);
}
function wrap(events: SimEvent[], enemyId: string, out: SurvivalEvent[]): void {
  for (const event of events) out.push({ kind: 'combat', event, entityIds: ['player', enemyId] });
}
export function waveProgression(wave:number) {
 const growth=Math.max(0,wave-1);
 return {
  speedRatio:Math.min(config.zombieMaxSpeedRatio,config.zombieSpeedRatio+growth*config.zombieSpeedGrowthPerWave),
  attackChance:Math.min(config.zombieMaxAttackChance,config.zombieAttackChance+growth*config.zombieAttackChanceGrowthPerWave),
  attackCooldownFrames:Math.max(config.zombieMinAttackCooldownFrames,config.zombieAttackCooldownFrames-growth*config.zombieAttackCooldownReductionPerWave),
  bossAttackChanceRatio:Math.min(config.bossMaxAttackChanceRatio,config.bossAttackChanceRatio+Math.max(0,Math.floor(wave/config.bossEveryWaves)-1)*config.bossAttackChanceGrowthPerBoss),
  attackStartGapFrames:Math.max(config.minAttackStartGapFrames,config.attackStartGapFrames-growth*config.attackStartGapReductionPerWave),
  concurrentAttacks:wave>=config.increasedConcurrencyWave?config.maxConcurrentAttacks:config.initialConcurrentAttacks,
 };
}
// Bounded startup/active slots; recovery never reserves a slot. No search planner.
export function attackPermission(r:SurvivalRun,kind:'boss'|'zombie'):boolean {
 const pressure=waveProgression(r.wave);
 if(r.tick-r.lastEnemyAttackTick<pressure.attackStartGapFrames)return false;
 const active=r.enemies.filter(e=>e.fighter.health>0&&e.fighter.punch&&phaseOf(e.fighter.punch)!=='recovery');
 if(active.length>=pressure.concurrentAttacks)return false;
 if(kind==='zombie'&&r.enemies.some(e=>e.kind==='boss'&&e.fighter.health>0))return !r.bossPending&&!active.some(e=>e.kind==='zombie');
 return true;
}
function zombieInput(r: SurvivalRun, e: SurvivalEnemy): FrameInput {
  const f = e.fighter, dx = r.player.x - f.x, dy = r.player.y - f.y, d = Math.hypot(dx, dy);
  const input = { ...NEUTRAL_INPUT };
  const reach = punchCfg(f, 'jab').reach + normalHurtRadius(r.player);
  if (d > reach && d > 0) { input.mx = Math.round(dx / d * 100 * e.speedRatio); input.my = Math.round(dy / d * 100 * e.speedRatio); }
  if (e.attackWait > 0) e.attackWait--;
  if (!f.punch && !f.dodge && e.attackWait === 0 && d <= reach) {
    if(!attackPermission(r,'zombie'))e.attackWait=config.zombieSlotRetryFrames;
    else if(random(r)>=waveProgression(r.wave).attackChance)e.attackWait=config.zombieFailedRetryFrames;
    else input.jab=true;
  }
  return input;
}
function resetMotion(f: Fighter): void {
  f.punch = null; f.dodge = null; f.guarding = false; f.guardFrames = 0;
  f.buffered = null; f.bufferFrames = 0; f.pushX = 0; f.pushY = 0; f.pushFrames = 0;
  f.lock = 0; f.stunTimer = 0; f.stun = 0; f.stunDecayWait = 0; f.stunFromMeter = false;
  f.postDodgeVulnerable = 0; f.guardPenalty = 0; f.dashBuff = 0;
}
export function endRun(r: SurvivalRun, reason: 'defeat' | 'abandoned'): SurvivalEvent[] {
  if (r.status === 'ended') return [];
  r.status = 'ended'; r.endReason = reason;
  return [{ kind: 'runEnded', reason, clearedWave: r.clearedWave }];
}
export function stepSurvival(r: SurvivalRun, input: FrameInput): SurvivalEvent[] {
  if (r.status !== 'active') return [];
  const out: SurvivalEvent[] = [];
  if (r.player.health <= 0) return endRun(r, 'defeat');
  if(r.tick<r.fightStartTick){
    if(r.tick===r.waveStartTick)out.push({kind:'combat',event:{kind:'ready'},entityIds:['player','']});
    r.tick++;
    if(r.tick===r.fightStartTick-fightCueTiming().entranceTicks)out.push({kind:'combat',event:{kind:'fightCue'},entityIds:['player','']});
    if(r.tick===r.fightStartTick)out.push({kind:'combat',event:{kind:'go'},entityIds:['player','']});
    return out;
  }
  const target = closestEnemy(r);
  const anchor = target?.fighter ?? combat.createFighter(r.player.x + 1, r.player.y, { anchored: true });
  const primary = pair(r, anchor);
  for (const f of [r.player, ...r.enemies.map(e => e.fighter)]) if (!f.infiniteStamina && f.stamina <= 0) { f.exhausted = true; f.regenWait = 0; }
  if (target) face(r.player, anchor);
  if (r.hitstop > 0) {
    r.hitstop--;
    for (const f of [r.player, ...r.enemies.map(e => e.fighter)]) if (f.exhausted) combat.gainStamina(f, tune.stamina.regenIdlePerSec * regenMult(f) / TICK_RATE, true);
    const events: SimEvent[] = [], req = combat.requestedAction(input);
    if (req && !combat.rejectAction(r.player, 0, req, events)) { r.player.buffered = req; r.player.bufferFrames = tune.input.bufferFrames; }
    wrap(events, target?.id ?? '', out);
  } else {
    const oldPunch = r.player.punch, inputEvents: SimEvent[] = [];
    combat.processInput(primary, 0, input, inputEvents);
    if (r.player.punch !== oldPunch) r.swingHits = [];
    combat.move(primary, 0, input); wrap(inputEvents, target?.id ?? '', out);
    const inputs = r.enemies.map(e => {
      face(e.fighter, r.player);
      const s = pair(r, e.fighter);
      let intent: FrameInput;
      if (e.kind === 'boss') {
        const ai = EasyAI.restore(1, r.bossAI!); intent = ai.think(s); r.bossAI = ai.snapshot();
        const request=combat.requestedAction(intent);
        const offense=request&&['jab','cross','hook','uppercut'].includes(request)?request as PunchState['type']:null;
        if(offense&&!r.bossPending&&random(r)<waveProgression(r.wave).bossAttackChanceRatio)r.bossPending={type:offense,frames:config.bossPendingFrames};
        intent={...intent,jab:false,cross:false,hook:false,uppercut:false};
        if(r.bossPending){
          if(!e.fighter.punch&&!e.fighter.dodge&&!intent.guard&&!intent.dodge&&attackPermission(r,'boss'))intent[r.bossPending.type]=true;
          else if(--r.bossPending.frames<=0)r.bossPending=null;
        }
      } else intent = zombieInput(r, e);
      const before = e.fighter.punch, events: SimEvent[] = [];
      // Offensive retries belong to the coordinator, not the duel input buffer:
      // a delayed buffered punch must never bypass spacing/concurrency permission.
      if(e.fighter.buffered&&e.fighter.buffered!=='dodge'){e.fighter.buffered=null;e.fighter.bufferFrames=0;}
      combat.processInput(s, 1, intent, events);
      if(e.fighter.punch&&e.fighter.punch!==before){
        r.lastEnemyAttackTick=r.tick;
        if(e.kind==='boss')r.bossPending=null;
        else{e.fighter.punch.damageMult*=config.zombieDamageMultiplier;e.fighter.punch.startup=Math.max(config.zombieMinStartupFrames,e.fighter.punch.startup);e.attackWait=waveProgression(r.wave).attackCooldownFrames;}
      }else if(e.kind==='zombie'&&intent.jab)e.attackWait=config.zombieSlotRetryFrames;
      else if(e.kind==='boss'&&r.bossPending&&(intent.jab||intent.cross||intent.hook||intent.uppercut)&&--r.bossPending.frames<=0)r.bossPending=null;
      combat.move(s, 1, intent); wrap(events, e.id, out);
      return intent;
    });
    separate(r);
    // Walking and crowd separation may switch the closest target this tick.
    const movedTarget = closestEnemy(r);
    if (movedTarget) face(r.player, movedTarget.fighter);
    // Snapshot all defensive states before any simultaneous contact resolves.
    const snapshots = r.enemies.map(e => [r.player, e.fighter].map(f => ({
      stance: stanceOf(f), startup: !!f.punch && phaseOf(f.punch) === 'startup', exhausted: f.exhausted,
      whiff: !!f.punch && f.punch.whiffFrames > 0 && phaseOf(f.punch) === 'recovery' && f.punch.frame >= punchTotal(f.punch) - f.punch.whiffFrames,
    })));
    const contacts = r.enemies.map(e => {
      const s = pair(r, e.fighter), events: SimEvent[] = [];
      if (r.player.punch) r.player.punch.resolved = r.swingHits.includes(e.id);
      const hits = combat.detectContacts(s, events, survivalPunchPoint);
      if (events.some(event => event.kind === 'dodged' && event.attacker === 0)) r.swingHits.push(e.id);
      wrap(events, e.id, out); return { s, hits };
    });
    contacts.forEach(({ s, hits }, i) => {
      const e = r.enemies[i], snap = snapshots[i], events: SimEvent[] = [];
      for (const hit of hits) {
        if (!s.fighters[hit.attacker].punch) continue; // A perfect guard can cancel a crowd swing.
        const defender=s.fighters[1-hit.attacker],beforeHp=Math.max(0,defender.health),eventStart=events.length;
        combat.resolveContact(s, hit, snap.map(v => v.stance), snap.map(v => v.startup), snap.map(v => v.whiff), snap.map(v => v.exhausted), events);
        if(events.slice(eventStart).some(e=>e.kind==='hit')){
          const applied=Math.max(0,Math.min(beforeHp,beforeHp-defender.health));
          if(hit.attacker===0)r.damageDealt+=applied;else r.damageReceived+=applied;
        }
        if (hit.attacker === 0) r.swingHits.push(e.id);
      }
      r.hitstop = Math.max(r.hitstop, s.hitstop); wrap(events, e.id, out);
    });
    if (r.player.punch) r.player.punch.resolved = r.swingHits.length > 0;
    const timerEvents: SimEvent[] = [];
    combat.advanceTimers(primary, 0, input, timerEvents); wrap(timerEvents, target?.id ?? '', out);
    r.enemies.forEach((e, i) => { const events: SimEvent[] = []; combat.advanceTimers(pair(r, e.fighter), 1, inputs[i], events); wrap(events, e.id, out); });
    for (const e of r.enemies) if (e.fighter.health <= 0) {
      r.waveKills++; r.totalKills++; if (e.kind === 'zombie') {r.waveZombieKills++;r.totalZombieKills++;}
      const fighter = structuredClone(e.fighter);
      const dx = fighter.lastBlow?.dx ?? fighter.x-r.player.x, dy = fighter.lastBlow?.dy ?? fighter.y-r.player.y;
      const length = Math.hypot(dx,dy);
      out.push({ kind: 'kill', enemyId: e.id, enemyKind: e.kind, visualId:e.visualId, fighter,
        position:{x:fighter.x,y:fighter.y}, direction:length>0?{x:dx/length,y:dy/length}:{x:1,y:0} });
    }
    r.enemies = r.enemies.filter(e => e.fighter.health > 0);
    if (--r.spawnWait <= 0) {
      if (r.bossChar && !r.bossSpawned) spawn(r, 'boss', out);
      else spawn(r, 'zombie', out);
      r.spawnWait = spawnInterval(r);
    }
  }
  const nextTarget = closestEnemy(r);
  if (nextTarget) face(r.player, nextTarget.fighter);
  r.tick++; if(!r.bossChar)r.remainingTicks = Math.max(0, r.remainingTicks - 1);
  if (r.player.health <= 0) out.push(...endRun(r, 'defeat'));
  else if (r.bossChar ? r.bossSpawned&&!r.enemies.some(e=>e.kind==='boss'&&e.fighter.health>0) : r.remainingTicks === 0) {
    r.remainingTicks=0;
    r.clearedWave = r.wave; r.status = 'intermission'; r.enemies = []; r.hitstop = 0; r.bossAI = null;r.bossPending=null;
    r.healing = Math.max(0, Math.min(maxHealth(r.player) - r.player.health, r.waveZombieKills * config.healPerZombieKill));
    r.player.health += r.healing; resetMotion(r.player);
    out.push({ kind: 'waveCleared', wave: r.wave, kills: r.waveKills, zombieKills: r.waveZombieKills, healing: r.healing });
  }
  return out;
}
export function survivalView(r: SurvivalRun) {
  const secondsLeft = Math.ceil(r.remainingTicks / TICK_RATE);
  const entity=r.enemies.find(e=>e.kind==='boss');
  const boss=r.bossChar?{state:entity&&entity.fighter.health>0?'alive' as const:r.bossSpawned?'defeated' as const:'incoming' as const,
    id:entity?.id??null,char:r.bossChar,currentHP:entity?Math.max(0,entity.fighter.health):r.bossSpawned?0:null,maxHP:entity?.maxHealth??null}:null;
  return {
    runId: r.runId, fighter: r.fighter, skin: r.skin, balanceVersion: r.balanceVersion,
    player: r.player, enemies: r.enemies, wave: r.wave, clearedWave: r.clearedWave,
    secondsLeft, timeText: `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`,
    waveKills: r.waveKills, zombieKills: r.waveZombieKills, totalKills: r.totalKills,
    totalZombieKills:r.totalZombieKills,totalBossKills:r.totalKills-r.totalZombieKills,
    damageDealt:r.damageDealt,damageReceived:r.damageReceived,
    ready:r.tick<r.fightStartTick, status: r.status, endReason: r.endReason, bossChar: r.bossChar,
    waveMode:r.bossChar?'boss' as const:'timed' as const,boss,
    nextBossWave: (Math.floor(r.wave / config.bossEveryWaves) + 1) * config.bossEveryWaves,
    healing: r.healing, canSave: r.status === 'intermission', xpEnabled: false as const,
    maxHealth: maxHealth(r.player), maxStamina: maxStamina(r.player),
  };
}
