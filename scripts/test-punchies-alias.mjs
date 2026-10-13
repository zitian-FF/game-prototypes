import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const cfg = JSON.parse(fs.readFileSync('prototypes/punchies/src/progress/alias.json', 'utf8'));
const progress = JSON.parse(fs.readFileSync('prototypes/punchies/src/progress/progress-config.json', 'utf8'));
const titleIds = progress.titles.map((t) => t.id);
const exports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('prototypes/punchies/src/progress/alias.ts', 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, Number, Math, String, Array, Object });
const a = exports;
const ok = (raw) => { const r = a.validateAlias(cfg, raw); assert(r.ok, `${JSON.stringify(raw)} should be accepted`); return r.alias; };
const bad = (raw, reason) => { const r = a.validateAlias(cfg, raw); assert(!r.ok && r.reason === reason, `${JSON.stringify(raw)} should fail as ${reason}, got ${JSON.stringify(r)}`); };

// Accepted: letters and digits in any script, single inner spaces.
assert.equal(ok('Marco'), 'Marco');
assert.equal(ok('  Lil   Tiger  '), 'Lil Tiger');
assert.equal(ok('Boxer 1234'), 'Boxer 1234');
assert.equal(ok('ボクサー'), 'ボクサー');
assert.equal(ok('拳王小明'), '拳王小明');
assert.equal(ok('권투왕'), '권투왕');
assert.equal(ok('Púgil'), 'Púgil');
assert.equal(ok('ملاكم١٢٣'), 'ملاكم١٢٣');

// Length counts characters, not code units, and is checked after cleaning.
bad('ab', 'short');
bad('', 'short');
bad(undefined, 'short');
bad(42, 'short');
bad('abcdefghijklm', 'long');
assert.equal(ok('abcdefghijkl'), 'abcdefghijkl');
bad('😀😀😀', 'chars');
// Symbols, punctuation and emoji are rejected.
bad('Bo<b>xer', 'chars');
bad('Marco_99', 'chars');
bad('https://x.io', 'chars');
bad('Marco 😀', 'chars');
// Invisible and bidirectional characters are stripped, not smuggled through.
assert.equal(ok('Mar​co'), 'Marco');
assert.equal(ok('‮Marco‬'), 'Marco');
assert.equal(ok('Mar\u0007co'), 'Marco');
// Reserved names cannot be impersonated.
bad('Admin', 'reserved');
bad('A d m i n', 'reserved');
bad('PUNCHIES', 'reserved');
bad('Modéra tor'.replace('é', 'e'), 'reserved');

// Offensive list is applied to the compacted lowercase form.
const withList = { ...cfg, offensive: ['badword'] };
assert.equal(a.validateAlias(withList, 'My Bad Word').reason, 'blocked');
assert.equal(a.validateAlias(withList, 'Fine Name').ok, true);

// Default alias.
assert.equal(a.defaultAlias(cfg, 0), 'Boxer 1000');
assert.equal(a.defaultAlias(cfg, 0.999999999), 'Boxer 9999');
assert(a.validateAlias(cfg, a.defaultAlias(cfg, 0.5)).ok, 'the default alias passes the rules');
assert.equal(a.defaultAlias(cfg, NaN), 'Boxer 1000');

// Platform names are trimmed to fit, never rejected for length.
assert.equal(a.fitPlatformName(cfg, 'SuperLongPlatformName'), 'SuperLongPla');
assert.equal(a.fitPlatformName(cfg, 'Cool_Boxer!!'), 'CoolBoxer');
assert.equal(a.fitPlatformName(cfg, '!!'), null);
assert.equal(a.fitPlatformName(cfg, null), null);

// A peer's profile is never trusted.
const read = (raw) => a.readPeerProfile(cfg, titleIds, progress.maxLevel, raw);
const good = read({ alias: 'Mia Fan', title: 'veteran', level: 22 });
assert.equal(good.alias, 'Mia Fan'); assert.equal(good.title, 'veteran'); assert.equal(good.level, 22);
assert.equal(read({ alias: '<script>', title: 'god', level: 9999 }).alias, 'Boxer');
assert.equal(read({ alias: 'Okay Name', title: 'god', level: 9999 }).title, titleIds[0], 'an unknown title id falls back');
assert.equal(read({ alias: 'Okay Name', title: 'rookie', level: 9999 }).level, progress.maxLevel, 'level is clamped');
assert.equal(read({ alias: 'Okay Name', title: 'rookie', level: -4 }).level, 1);
assert.equal(read({ alias: 'Okay Name', title: 'rookie', level: 'x' }).level, 1);
for (const junk of [null, undefined, 5, 'str', [], { alias: {} }]) {
  const p = read(junk);
  assert.equal(p.alias, 'Boxer'); assert.equal(p.title, titleIds[0]); assert.equal(p.level, 1);
}
assert.equal(read({ alias: 'Mar‮co' }).alias, 'Marco', 'bidi controls from a peer are stripped');

console.log('Alias: accepted scripts, length, symbols and emoji rejected, invisible and bidi characters stripped, reserved names, offensive list hook, default alias, platform name fitting and untrusted peer profiles passed');
