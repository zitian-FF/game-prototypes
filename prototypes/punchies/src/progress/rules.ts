// Boxer Level rules. Pure functions on plain data (no storage, no scenes), so they can be
// tested directly. The numbers live in progress-config.json.

export type MatchKind = 'vsai' | 'online' | 'localvs' | 'firstfight';
export type BotLevelName = 'easy' | 'medium' | 'hard';
export interface MatchOutcome { kind: MatchKind; win: boolean; botLevel?: BotLevelName; }

export interface ProgressConfig {
  maxLevel: number; levelBaseXp: number; levelStepXp: number; dailyXpCap: number;
  xp: { vsaiFinish: number; vsaiWin: number; onlineFinish: number; onlineWin: number; localFinish: number; firstFightWin: number };
  botMultiplier: Record<BotLevelName, number>;
  skinChestEvery: number; fighterChestEvery: number;
  titles: { id: string; level: number }[];
  skinRewards: Record<string, string>;
}

export interface ProgressState {
  version: 1;
  totalXp: number;
  day: string;
  xpToday: number;
  matches: number;
  wins: number;
  rewardedLevel: number;
  titleId: string | null;
}

export type Reward = { kind: 'skinChest' } | { kind: 'fighterChest' } | { kind: 'skin'; id: string } | { kind: 'title'; id: string };
export interface LevelUp { level: number; rewards: Reward[]; }
export interface MatchAward { state: ProgressState; xpGained: number; capped: boolean; levelUps: LevelUp[]; }

export const progressDay = (now = Date.now()): string => new Date(now).toISOString().slice(0, 10);

export function newProgress(day: string): ProgressState {
  return { version: 1, totalXp: 0, day, xpToday: 0, matches: 0, wins: 0, rewardedLevel: 1, titleId: null };
}

const count = (v: unknown, max = 1e9): number => (Number.isSafeInteger(v) && (v as number) >= 0 ? Math.min(v as number, max) : 0);

export function normalizeProgress(value: unknown, day: string, cfg: ProgressConfig): ProgressState {
  if (!value || typeof value !== 'object') return newProgress(day);
  const v = value as Partial<ProgressState>;
  if (v.version !== 1) return newProgress(day);
  const totalXp = count(v.totalXp);
  const sameDay = v.day === day;
  const s: ProgressState = {
    version: 1, totalXp, day,
    xpToday: sameDay ? Math.min(count(v.xpToday), cfg.dailyXpCap) : 0,
    matches: count(v.matches), wins: count(v.wins),
    rewardedLevel: Math.max(1, Math.min(count(v.rewardedLevel), cfg.maxLevel)),
    titleId: typeof v.titleId === 'string' ? v.titleId : null,
  };
  if (s.titleId && !unlockedTitles(cfg, levelFromXp(cfg, totalXp)).includes(s.titleId)) s.titleId = null;
  return s;
}

/** XP needed to go from `level` to `level + 1`. */
export const xpForLevel = (cfg: ProgressConfig, level: number): number => cfg.levelBaseXp + cfg.levelStepXp * (level - 1);

export function levelFromXp(cfg: ProgressConfig, totalXp: number): number {
  let level = 1;
  let left = totalXp;
  while (level < cfg.maxLevel && left >= xpForLevel(cfg, level)) { left -= xpForLevel(cfg, level); level++; }
  return level;
}

/** Raw XP for one finished match, before the daily cap. */
export function matchXp(cfg: ProgressConfig, m: MatchOutcome): number {
  const x = cfg.xp;
  switch (m.kind) {
    case 'vsai': return Math.round((x.vsaiFinish + (m.win ? x.vsaiWin : 0)) * (cfg.botMultiplier[m.botLevel ?? 'medium'] ?? 1));
    case 'online': return x.onlineFinish + (m.win ? x.onlineWin : 0);
    case 'localvs': return x.localFinish;
    case 'firstfight': return m.win ? x.firstFightWin : 0;
  }
}

export function rewardsForLevel(cfg: ProgressConfig, level: number): Reward[] {
  const out: Reward[] = [];
  for (const t of cfg.titles) if (t.level === level && level > 1) out.push({ kind: 'title', id: t.id });
  const skin = cfg.skinRewards[String(level)];
  if (skin) out.push({ kind: 'skin', id: skin });
  if (level % cfg.fighterChestEvery === 0) out.push({ kind: 'fighterChest' });
  else if (level % cfg.skinChestEvery === 0) out.push({ kind: 'skinChest' });
  return out;
}

export function unlockedTitles(cfg: ProgressConfig, level: number): string[] {
  return cfg.titles.filter((t) => t.level <= level).map((t) => t.id);
}

export function applyMatch(cfg: ProgressConfig, state: ProgressState, m: MatchOutcome, day: string): MatchAward {
  const s: ProgressState = normalizeProgress(state, day, cfg);
  const before = levelFromXp(cfg, s.totalXp);
  const raw = before >= cfg.maxLevel ? 0 : matchXp(cfg, m);
  const room = Math.max(0, cfg.dailyXpCap - s.xpToday);
  const xpGained = Math.min(raw, room);
  s.totalXp += xpGained;
  s.xpToday += xpGained;
  if (m.kind !== 'firstfight') { s.matches++; if (m.win) s.wins++; }
  const after = levelFromXp(cfg, s.totalXp);
  const levelUps: LevelUp[] = [];
  for (let level = s.rewardedLevel + 1; level <= after; level++) levelUps.push({ level, rewards: rewardsForLevel(cfg, level) });
  s.rewardedLevel = Math.max(s.rewardedLevel, after);
  return { state: s, xpGained, capped: raw > xpGained, levelUps };
}

export interface ProgressView {
  level: number; xp: number; xpToNext: number; maxed: boolean;
  xpToday: number; capToday: number; capReached: boolean;
  title: string; unlockedTitles: string[];
  nextRewards: LevelUp[]; matches: number; wins: number;
}

export function progressView(cfg: ProgressConfig, state: ProgressState, day: string): ProgressView {
  const s = normalizeProgress(state, day, cfg);
  const level = levelFromXp(cfg, s.totalXp);
  let into = s.totalXp;
  for (let l = 1; l < level; l++) into -= xpForLevel(cfg, l);
  const maxed = level >= cfg.maxLevel;
  const unlocked = unlockedTitles(cfg, level);
  const nextRewards: LevelUp[] = [];
  for (let l = level + 1; l <= cfg.maxLevel && nextRewards.length < 4; l++) {
    const rewards = rewardsForLevel(cfg, l);
    if (rewards.length) nextRewards.push({ level: l, rewards });
  }
  return {
    level, xp: maxed ? 0 : into, xpToNext: maxed ? 0 : xpForLevel(cfg, level), maxed,
    xpToday: s.xpToday, capToday: cfg.dailyXpCap, capReached: s.xpToday >= cfg.dailyXpCap,
    title: s.titleId ?? unlocked[unlocked.length - 1] ?? cfg.titles[0].id, unlockedTitles: unlocked,
    nextRewards, matches: s.matches, wins: s.wins,
  };
}
