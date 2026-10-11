import { KEYS } from '../portal/keys';
import { isCharId, maxHealth, maxStamina } from '../sim/character';
import { createRun, endRun, startNextWave, stepSurvival, survivalBalanceVersion } from './sim';
import type { FrameInput } from '../sim/types';
import type { RunOptions, SurvivalBest, SurvivalRun } from './types';

export interface SurvivalStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
interface SavedRun { schema: 1; phase: 'active' | 'checkpoint' | 'ended'; checkpoint: SurvivalRun | null; best: SurvivalBest | null }
export type ResumeResult =
  | { kind: 'ready'; run: SurvivalRun }
  | { kind: 'none' | 'abandoned' | 'corrupt' }
  | { kind: 'incompatible'; savedVersion: string; currentVersion: string };
function finiteTree(v: unknown): boolean {
  if (typeof v === 'number') return Number.isFinite(v);
  if (Array.isArray(v)) return v.every(finiteTree);
  if (v && typeof v === 'object') return Object.values(v).every(finiteTree);
  return v === null || ['string', 'boolean'].includes(typeof v);
}
function validBest(v: unknown): v is SurvivalBest {
  const b = v as SurvivalBest;
  return !!b && isCharId(b.fighter) && typeof b.skin === 'string' && typeof b.balanceVersion === 'string' && typeof b.runId === 'string' && Number.isSafeInteger(b.clearedWave) && b.clearedWave >= 0;
}
function validCheckpoint(v: unknown): v is SurvivalRun {
  const r = v as SurvivalRun;
  if (!r || !finiteTree(r) || !isCharId(r.fighter) || typeof r.skin !== 'string' || typeof r.runId !== 'string' || typeof r.balanceVersion !== 'string') return false;
  if (r.status !== 'intermission' || r.endReason !== null || r.remainingTicks !== 0 || r.wave !== r.clearedWave || r.wave < 1 || !Number.isSafeInteger(r.wave)) return false;
  if (!Number.isSafeInteger(r.seed) || !Number.isSafeInteger(r.rngState) || r.seed < 0 || r.seed > 0xffffffff || r.rngState < 0 || r.rngState > 0xffffffff) return false;
  if (!Number.isSafeInteger(r.tick) || r.tick < 0 || !Number.isSafeInteger(r.nextEnemyId) || r.nextEnemyId < 1) return false;
  if (!Array.isArray(r.enemies) || r.enemies.length || r.bossAI !== null || !Array.isArray(r.swingHits) || !r.swingHits.every(s => typeof s === 'string')) return false;
  if (![r.totalKills, r.waveKills, r.waveZombieKills].every(n => Number.isSafeInteger(n) && n >= 0) || r.waveZombieKills > r.waveKills || r.waveKills > r.totalKills) return false;
  const p = r.player;
  if (!p || p.char !== r.fighter || p.health <= 0 || p.punch || p.dodge || p.guarding || p.buffered) return false;
  // Check complete Fighter shape against a fresh template, including nested counters.
  const template = createRun({ fighter: r.fighter, skin: r.skin, seed: r.seed, runId: r.runId }).player;
  function shape(a: unknown, b: unknown): boolean {
    if (b === null) return a === null;
    if (typeof b !== 'object') return typeof a === typeof b;
    if (!a || typeof a !== 'object') return false;
    return Object.entries(b as object).every(([key, value]) => shape((a as Record<string, unknown>)[key], value));
  }
  const {lastBlow: _blow, ...savedBody} = p;
  const {lastBlow: _templateBlow, ...templateBody} = template;
  const blow = p.lastBlow;
  const validBlow = blow === null || (!!blow && ['jab', 'cross', 'hook', 'uppercut'].includes(blow.punch) && typeof blow.sweet === 'boolean' && typeof blow.chip === 'boolean' && typeof blow.dx === 'number' && typeof blow.dy === 'number');
  return validBlow && shape(savedBody, templateBody);
}
/** Use portal/store as the adapter so portal SDK save preload stays intact.
 * UI calls checkpoint after waveCleared, advance before starting the next wave,
 * and finish after runEnded. No active combat snapshot is resumable. */
export class SurvivalStore {
  constructor(private storage: SurvivalStorage) {}
  private read(): SavedRun | null {
    const text = this.storage.getItem(KEYS.survival);
    if (!text) return null;
    const s = JSON.parse(text) as SavedRun;
    if (!s || s.schema !== 1 || !['active', 'checkpoint', 'ended'].includes(s.phase) || (s.best !== null && !validBest(s.best))) throw new Error('Invalid survival save');
    if (s.phase === 'checkpoint' ? !validCheckpoint(s.checkpoint) : s.checkpoint !== null) throw new Error('Invalid survival checkpoint');
    return s;
  }
  private write(s: SavedRun): void {
    const text = JSON.stringify(s); this.storage.setItem(KEYS.survival, text);
    if (this.storage.getItem(KEYS.survival) !== text) throw new Error('Survival save unavailable');
  }
  best(): SurvivalBest | null { try { return this.read()?.best ?? null; } catch { return null; } }
  private record(r: SurvivalRun): SurvivalBest | null {
    const best = this.best();
    return r.clearedWave > (best?.clearedWave ?? 0) ? { clearedWave: r.clearedWave, fighter: r.fighter, skin: r.skin, balanceVersion: r.balanceVersion, runId: r.runId } : best;
  }
  begin(opts: RunOptions): SurvivalRun {
    const r = createRun(opts); this.write({ schema: 1, phase: 'active', checkpoint: null, best: this.best() }); return r;
  }
  step(r: SurvivalRun, input: FrameInput) {
    const events = stepSurvival(r, input);
    if (events.some(e => e.kind === 'waveCleared')) this.checkpoint(r);
    if (events.some(e => e.kind === 'runEnded')) this.finish(r);
    return events;
  }
  checkpoint(r: SurvivalRun): boolean {
    if (r.status !== 'intermission' || !validCheckpoint(r)) return false;
    this.write({ schema: 1, phase: 'checkpoint', checkpoint: structuredClone(r), best: this.record(r) }); return true;
  }
  // Atomic save-before-step: an interrupted active attempt cannot replay its old checkpoint.
  advance(r: SurvivalRun) {
    if (r.status !== 'intermission') return [];
    this.write({ schema: 1, phase: 'active', checkpoint: null, best: this.record(r) });
    return startNextWave(r);
  }
  saveAndExit(r: SurvivalRun): boolean { return this.checkpoint(r); }
  finish(r: SurvivalRun): boolean {
    if (r.status !== 'ended') return false;
    this.write({ schema: 1, phase: 'ended', checkpoint: null, best: this.record(r) }); return true;
  }
  abandon(r: SurvivalRun): void { endRun(r, 'abandoned'); this.finish(r); }
  loadResume(currentVersion = survivalBalanceVersion()): ResumeResult {
    let s: SavedRun | null;
    try { s = this.read(); } catch { return { kind: 'corrupt' }; }
    if (!s || s.phase === 'ended') return { kind: 'none' };
    if (s.phase === 'active') { this.write({ ...s, phase: 'ended' }); return { kind: 'abandoned' }; }
    const r = s.checkpoint!;
    if (r.balanceVersion !== currentVersion) return { kind: 'incompatible', savedVersion: r.balanceVersion, currentVersion };
    if (r.player.health > maxHealth(r.player) || r.player.stamina < 0 || r.player.stamina > maxStamina(r.player)) return { kind: 'corrupt' };
    return { kind: 'ready', run: structuredClone(r) };
  }
}
