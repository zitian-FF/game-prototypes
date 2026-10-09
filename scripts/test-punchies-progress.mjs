import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const cfg = JSON.parse(fs.readFileSync('prototypes/punchies/src/progress/progress-config.json', 'utf8'));
const exports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/progress/rules.ts', 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, Date, Math, Number, Object, JSON, String, Array });
const r = exports;
const day = '2026-10-09', next = '2026-10-10';

// Level curve: level 1 -> 2 costs 100, then +25 each level.
assert.equal(r.xpForLevel(cfg, 1), 100);
assert.equal(r.xpForLevel(cfg, 2), 125);
assert.equal(r.levelFromXp(cfg, 0), 1);
assert.equal(r.levelFromXp(cfg, 99), 1);
assert.equal(r.levelFromXp(cfg, 100), 2);
assert.equal(r.levelFromXp(cfg, 225), 3);
assert.equal(r.levelFromXp(cfg, 1e9), cfg.maxLevel, 'level is capped');

// Match XP.
assert.equal(r.matchXp(cfg, { kind: 'vsai', win: true, botLevel: 'medium' }), 30);
assert.equal(r.matchXp(cfg, { kind: 'vsai', win: false, botLevel: 'medium' }), 10);
assert.equal(r.matchXp(cfg, { kind: 'vsai', win: true, botLevel: 'easy' }), 15);
assert.equal(r.matchXp(cfg, { kind: 'vsai', win: true, botLevel: 'hard' }), 45);
assert.equal(r.matchXp(cfg, { kind: 'online', win: true }), 40);
assert.equal(r.matchXp(cfg, { kind: 'online', win: false }), 15);
assert.equal(r.matchXp(cfg, { kind: 'localvs', win: true }), 10, 'local VS has no win bonus');
assert.equal(r.matchXp(cfg, { kind: 'firstfight', win: false }), 0);

// Daily hard cap: XP past the cap is lost and reported, and a new UTC day resets it.
let s = r.newProgress(day);
let total = 0, cappedSeen = false;
for (let i = 0; i < 20; i++) {
  const a = r.applyMatch(cfg, s, { kind: 'online', win: true }, day);
  s = a.state; total += a.xpGained; cappedSeen ||= a.capped;
}
assert.equal(total, cfg.dailyXpCap, 'a day never gives more than the cap');
assert.equal(s.xpToday, cfg.dailyXpCap);
assert(cappedSeen);
assert.equal(s.matches, 20, 'matches still count after the cap');
const tomorrow = r.applyMatch(cfg, s, { kind: 'online', win: true }, next);
assert.equal(tomorrow.xpGained, 40, 'the cap resets on the next UTC day');
assert.equal(tomorrow.state.xpToday, 40);

// Level-ups: rewards granted once, chests only at milestones.
let g = r.newProgress(day);
g = { ...g, totalXp: 0 };
const big = { ...cfg, dailyXpCap: 1e9 };
const up = r.applyMatch(big, { ...g, totalXp: 0 }, { kind: 'firstfight', win: true }, day);
assert.equal(up.xpGained, cfg.xp.firstFightWin);
let state = r.newProgress(day);
const seen = [];
for (let i = 0; i < 1200; i++) {
  const a = r.applyMatch(big, state, { kind: 'online', win: true }, day);
  state = a.state;
  for (const l of a.levelUps) seen.push(l);
}
assert.equal(r.levelFromXp(big, state.totalXp), cfg.maxLevel);
const levels = seen.map((l) => l.level);
assert.equal(levels.length, new Set(levels).size, 'each level up is reported once');
assert.equal(levels.length, cfg.maxLevel - 1);
const at = (n) => seen.find((l) => l.level === n).rewards;
assert(at(2).length === 0, 'level 2 has no reward');
assert.equal(JSON.stringify(at(5).map((x) => x.kind)), '["skinChest"]');
assert.equal(JSON.stringify(at(10).map((x) => x.kind)), '["fighterChest"]');
assert(at(12).some((x) => x.kind === 'skin' && x.id === 'skin-marco-veteran'));
assert(at(12).some((x) => x.kind === 'title' && x.id === 'contender'));
assert(!seen.some((l) => l.rewards.some((x) => x.kind === 'skinChest' && l.level % 10 === 0)), 'no skin chest on a fighter chest level');
assert.equal(r.applyMatch(big, state, { kind: 'online', win: true }, day).xpGained, 0, 'no XP at max level');

// A crash between XP and reward grant is repaired on the next match: rewardedLevel lags, rewards still come.
const lagging = { ...r.newProgress(day), totalXp: 800, rewardedLevel: 1 };
assert.equal(r.applyMatch(cfg, lagging, { kind: 'localvs', win: false }, day).levelUps[0].level, 2);

// View.
const v = r.progressView(cfg, { ...r.newProgress(day), totalXp: 150 }, day);
assert.equal(v.level, 2); assert.equal(v.xp, 50); assert.equal(v.xpToNext, 125);
assert.equal(v.title, 'rookie');
assert(v.nextRewards.length > 0 && v.nextRewards[0].level > 2);
const vt = r.progressView(cfg, { ...r.newProgress(day), totalXp: 5000, titleId: 'legend' }, day);
assert(vt.unlockedTitles.length < cfg.titles.length || vt.level >= 50);
assert.notEqual(vt.title, 'legend', 'a title that is not unlocked yet is ignored');

// Save data hardening.
assert.equal(r.normalizeProgress({ version: 1, totalXp: -5, matches: 'x' }, day, cfg).totalXp, 0);
assert.equal(r.normalizeProgress({ version: 2 }, day, cfg).totalXp, 0);
assert.equal(r.normalizeProgress('junk', day, cfg).level ?? 0, 0);
assert.equal(r.normalizeProgress({ version: 1, totalXp: 10, day, xpToday: 99999 }, day, cfg).xpToday, cfg.dailyXpCap);

// Title list and config sanity.
const ids = cfg.titles.map((t) => t.id);
assert.deepEqual(ids, [...new Set(ids)]);
assert.deepEqual(cfg.titles.map((t) => t.level), [...cfg.titles.map((t) => t.level)].sort((a, b) => a - b));
const en = JSON.parse(fs.readFileSync('prototypes/punchies/src/i18n/locales/en.json', 'utf8'));
for (const id of ids) assert(en[`title.${id}`], `title.${id} has an English name`);

console.log('Progress: XP rules, level curve, daily hard cap and UTC reset, milestone rewards, once-only level-ups, max level, repair of lagging rewards, view, title unlocks and save hardening passed');
