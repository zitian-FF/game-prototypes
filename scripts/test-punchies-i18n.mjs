import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import ts from 'typescript';
import { loadTs } from './lib-punchies-data.mjs';

const src = 'prototypes/punchies/src';
const localesDir = `${src}/i18n/locales`;
const en = JSON.parse(fs.readFileSync(`${localesDir}/en.json`, 'utf8'));
// Check decoded strings too: an escaped replacement character is equally broken.
for (const file of fs.readdirSync(localesDir).filter(f => f.endsWith('.json'))) {
  const locale = JSON.parse(fs.readFileSync(`${localesDir}/${file}`, 'utf8'));
  for (const [key, value] of Object.entries(locale)) {
    assert.ok(!key.includes('\uFFFD') && !(typeof value === 'string' && value.includes('\uFFFD')),
      `${file}: ${key} contains a Unicode replacement character`);
  }
}
for (const key of ['input.keyboard_left', 'input.keyboard_right', 'input.controller']) {
  assert.equal(en[key].split('\u00b7').length - 1, 3, `${key}: expected three middle-dot separators`);
}
if (process.argv.includes('--encoding-only')) {
  console.log('PASS: every decoded locale key/string excludes U+FFFD; input instructions use middle-dot separators.');
  process.exit(0);
}
const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
const walk = (d) => fs.readdirSync(d).flatMap((f) => { const p = path.join(d, f); return fs.statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : []; });
const files = walk(src).map(f => f.split(path.sep).join('/')).filter((f) => !f.replaceAll('\\','/').includes('/i18n/'));

// ---- 1. every t() key exists, with the right placeholders; no unused keys ----
const used = new Set();
const dynamic = [];
const allLiterals = new Set();
for (const file of files) {
  const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.ES2022, true);
  const visit = (n) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) allLiterals.add(n.text);
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && (n.expression.text === 't' || n.expression.text === 'tOr')) {
      const [first, second, third] = n.arguments;
      const params = n.expression.text === 't' ? second : third;
      const where = `${file}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`;
      if (first && (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first))) {
        used.add(first.text);
        if (n.expression.text === 't') {
          assert.ok(first.text in en, `${where}: missing key ${first.text}`);
          const given = params && ts.isObjectLiteralExpression(params) ? params.properties.map((p) => p.name?.getText()).sort().join(',') : '';
          assert.equal(given, placeholders(en[first.text]), `${where}: ${first.text} parameters (${given}) do not match its placeholders (${placeholders(en[first.text])})`);
        }
      } else if (first) dynamic.push({ where, text: first.getText() });
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}
// Dynamic keys are limited to a few groups, each checked for completeness below.
const { CHARACTER_IDS } = await loadTs('./prototypes/punchies/src/sim/character', ['CHARACTER_IDS']);
const progressCfg = JSON.parse(fs.readFileSync(`${src}/progress/progress-config.json`, 'utf8'));
const groups = { 'level.': ['easy', 'medium', 'hard'], 'quote.': CHARACTER_IDS, 'char.': CHARACTER_IDS, 'title.': progressCfg.titles.map((x) => x.id) };
for (const d of dynamic) assert.ok(/level\.|quote\.|char\.|title\.|shop\.item\.|layouts\.|reasonKey|STANCE_KEY/.test(d.text), `${d.where}: unexpected dynamic key ${d.text}`);
// Explicit dynamic glyph/editor families; removed fixed readouts retain existing translations.
const layoutDynamic = [
  'kb1', 'kb2', 'pad1', 'pad2', 'touch',
  ...['up', 'down', 'left', 'right', 'jab', 'cross', 'hook', 'uppercut', 'dodge', 'guard'].map(a => 'action_' + a),
  ...['stick', 'main', 'hook', 'guard', 'dodge', 'uppercut'].map(a => 'touch_' + a),
  ...['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'Space', 'Enter', 'Add', 'Subtract', 'Multiply', 'Divide', 'Decimal', 'Backspace', 'Tab', 'CapsLock'].map(c => 'key_' + c),
  ...[12, 13, 14, 15].map(n => 'dpad_' + n),
];
for (const id of layoutDynamic) { const key = 'layouts.' + id; assert.ok(key in en, `missing dynamic input glyph/editor key ${key}`); used.add(key); }
for (const key of ['input.keyboard_left', 'input.keyboard_right', 'input.controller', 'input.keys_wasd', 'input.keys_arrows', 'firstfight.coach_move', 'firstfight.coach_jab', 'firstfight.coach_cross']) used.add(key);
for (const m of fs.readFileSync(`${src}/shop/draft.ts`, 'utf8').matchAll(/reasonKey:'([^']+)'/g)) { assert.ok(m[1] in en, `missing shop error key ${m[1]}`); used.add(m[1]); }
for (const [prefix, ids] of Object.entries(groups)) for (const id of ids) {
  const key = prefix === 'char.' ? `char.${id}.nick` : `${prefix}${id}`;
  assert.ok(key in en, `missing ${key}`);
  used.add(key);
}
const { SHOP_ITEMS } = await loadTs('./prototypes/punchies/src/shop/draft', ['SHOP_ITEMS']);
for (const item of SHOP_ITEMS) { assert.ok(`shop.item.${item.id}.name` in en, `missing name for shop item ${item.id}`); used.add(`shop.item.${item.id}.name`); }
for (const key of Object.keys(en)) if (allLiterals.has(key)) used.add(key);
const unused = Object.keys(en).filter((k) => !used.has(k));
assert.deepEqual(unused, [], `unused English keys: ${unused.join(', ')}`);

// ---- 2. no obviously hardcoded English left in player-facing text calls ----
// Allowed: developer-only screens (reference panel, net stats, lobby diagnostics) and short symbols.
const devOnly = [/ui\/InfoPanel\.ts$/, /scenes\/MatchScene\.ts$/, /scenes\/LobbyScene\.ts$/];
const shown = new Set(['text', 'setText', 'titleButton', 'makeButton', 'button', 'label', 'banner']);
const hard = [];
for (const file of files) {
  if (devOnly.some((r) => r.test(file))) continue;
  const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.ES2022, true);
  const visit = (n) => {
    if (ts.isCallExpression(n)) {
      const name = ts.isPropertyAccessExpression(n.expression) ? n.expression.name.text : ts.isIdentifier(n.expression) ? n.expression.text : '';
      if (shown.has(name)) for (const a of n.arguments) {
        if ((ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a)) && /[A-Za-z]{3,}/.test(a.text) && !/^(#|0x|\.|\/|http|punchies:|portrait_|part_|gameMenu:)|^[a-z_]+$|px$|^PUNCHIES$/.test(a.text) && !/^(Arial|monospace|Impact)/.test(a.text) && !/^[WASD ]+$/.test(a.text))
          hard.push(`${file}:${sf.getLineAndCharacterOfPosition(a.getStart()).line + 1} ${JSON.stringify(a.text.slice(0, 50))}`);
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}
assert.deepEqual(hard, [], `hardcoded text passed to a text call (use t()):\n${hard.join('\n')}`);

// ---- 3. the translation layer itself ----
const out = await build({
  stdin: { contents: `export * from './${src}/i18n/index'; export * from './${src}/i18n/languages'; export { tweakTextStyle } from './${src}/i18n/textStyle';`, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, platform: 'node', format: 'esm', write: false, loader: { '.json': 'json' },
});
const i18n = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
const first = Object.keys(en).find((k) => placeholders(en[k]) === 'btn');
i18n.setLocaleLoader(async (code) => (code === 'ja' ? { [first]: '日本語 {btn}' } : code === 'ko' ? (() => { throw new Error('boom'); })() : {}), { ja: 1, ko: 1 });
assert.equal(i18n.t(first, { btn: 'X' }), en[first].replace('{btn}', 'X'), 'English by default');
assert.equal(i18n.t('no.such.key'), 'no.such.key', 'unknown key shows the key');
assert.equal(i18n.tOr('no.such.key', 'Fallback {n}', { n: 2 }), 'Fallback 2');
await i18n.setLanguage('ja');
assert.equal(i18n.t(first, { btn: 'X' }), '日本語 X', 'translated');
const another = Object.keys(en).find((k) => k !== first);
assert.equal(i18n.t(another, {}), en[another], 'untranslated keys fall back to English');
await i18n.setLanguage('ko');
assert.equal(i18n.t(another), en[another], 'a language that fails to load falls back to English');
await i18n.setLanguage('pseudo');
assert.match(i18n.t(another, {}), /^⟦.*⟧$/, 'pseudo-locale wraps text');
await i18n.setLanguage('en');
assert.deepEqual(i18n.availableLanguages().map((l) => l.code), ['en', 'ja', 'ko'], 'only languages with translations are offered');
assert.equal(i18n.availableLanguages(true).length, 6, 'debug offers all six');
// Choosing the starting language
assert.equal(i18n.pickInitialLanguage('ja', null, null), 'ja');
assert.equal(i18n.pickInitialLanguage('es', null, null), 'en', 'a saved language without translations is ignored');
assert.equal(i18n.pickInitialLanguage(null, 'ko-KR', 'en-US'), 'ko', 'portal language beats browser language');
assert.equal(i18n.pickInitialLanguage(null, null, 'ja_JP'), 'ja');
assert.equal(i18n.pickInitialLanguage(null, null, 'fr-FR'), 'en');
assert.equal(i18n.pickInitialLanguage('ja', null, null, '?lang=es'), 'es', '?lang= forces a language');
assert.equal(i18n.pickInitialLanguage(null, null, null, '?lang=pseudo'), 'pseudo');
assert.equal(i18n.matchLocale('zh-Hans-CN'), 'zh');
assert.equal(i18n.matchLocale('ar-EG'), 'ar');
// Text style tweaks
await i18n.setLanguage('en');
assert.equal(i18n.tweakTextStyle({ fontFamily: 'Arial' }).fontFamily, 'Arial', 'English style untouched');
i18n.setLocaleLoader(async () => ({}), { ar: 1, ja: 1 });
await i18n.setLanguage('ar');
assert.equal(i18n.t('no.such.key'), '\u202Bno.such.key\u202C', 'Arabic text is wrapped in a right-to-left embedding');
assert.equal(i18n.tweakTextStyle({ fontFamily: 'Arial' }).rtl, undefined, 'no layout mirroring');
assert.match(i18n.tweakTextStyle({ fontFamily: 'Arial' }).fontFamily, /Arial,.*Tahoma/);
await i18n.setLanguage('ja');
assert.match(i18n.tweakTextStyle({}).fontFamily, /Hiragino|Meiryo/);
assert.equal(i18n.tweakTextStyle({}).rtl, undefined);

// ---- 4. the Google Sheets round trip ----
execFileSync('node', ['scripts/i18n-sheet.mjs', 'check']);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-'));
fs.cpSync(localesDir, tmp, { recursive: true });
// Round-trip fixtures start empty independently of shipped translation coverage.
for (const lang of ['ja','ko','zh','es','ar']) fs.writeFileSync(path.join(tmp, lang + '.json'), '{}');
const env = { ...process.env, I18N_DIR: tmp };
const csv = path.join(tmp, 'sheet.csv');
execFileSync('node', ['scripts/i18n-sheet.mjs', 'export', csv, '--formulas'], { env });
const text = fs.readFileSync(csv, 'utf8');
assert.match(text, /GOOGLETRANSLATE\(B2,""en"",""ja""\)/, 'formulas are written for empty cells');
const multi = Object.keys(en).find((k) => en[k].includes('\n'));
const withHole = text.split('\n').filter(Boolean);
const rows = withHole.slice(1).map((l) => l.split(',')[0]);
// Build a returned sheet: Japanese filled for a placeholder row (spaced braces) and a row with a bad placeholder.
const body = `key,en,ja,zh\n${first},"${en[first]}","日本語 { btn }",\n${another},"${en[another]}",,"中文"\nbad.key,Hello,"x",\n`;
fs.writeFileSync(csv, body);
const report = execFileSync('node', ['scripts/i18n-sheet.mjs', 'import', csv], { env }).toString();
assert.match(report, /not an English key/);
const ja = JSON.parse(fs.readFileSync(path.join(tmp, 'ja.json'), 'utf8'));
assert.equal(ja[first], '日本語 {btn}', 'spaced placeholders are repaired');
const zh = JSON.parse(fs.readFileSync(path.join(tmp, 'zh.json'), 'utf8'));
assert.equal(zh[another], '中文');
assert.deepEqual(JSON.parse(fs.readFileSync(path.join(tmp, 'index.json'), 'utf8')), { ja: 1, zh: 1 }, 'coverage index lists languages that have translations');
const bad = `key,en,ja\n${first},"${en[first]}","日本語 {other}"\n`;
fs.writeFileSync(csv, bad);
const report2 = execFileSync('node', ['scripts/i18n-sheet.mjs', 'import', csv], { env }).toString();
assert.match(report2, /placeholders .* do not match/);
assert.equal(Object.keys(JSON.parse(fs.readFileSync(path.join(tmp, 'ja.json'), 'utf8'))).length, 0, 'a cell with the wrong placeholders is rejected');
// pull: the published CSV is downloaded, imported whole, and bad answers are refused.
const pull = (body, status = 200) => {
  fs.writeFileSync(path.join(tmp, 'answer.txt'), body);
  try {
    return { out: execFileSync('node', ['--import', './scripts/lib-fetch-stub.mjs', 'scripts/i18n-sheet.mjs', 'pull', 'https://docs.google.com/spreadsheets/d/e/x/pub?output=csv'],
      { env: { ...env, STUB_FETCH_BODY: path.join(tmp, 'answer.txt'), STUB_FETCH_STATUS: String(status) }, stdio: 'pipe' }).toString(), ok: true };
  } catch (e) { return { out: String(e.stderr), ok: false }; }
};
const all = Object.keys(en).map((k) => `${JSON.stringify(k)},${JSON.stringify(en[k])},${JSON.stringify('X' + en[k])}`).join('\n');
const good = pull(`key,en,ja\n${all}\n`);
assert.ok(good.ok && /coverage/.test(good.out), 'pull imports a complete sheet');
assert.equal(Object.keys(JSON.parse(fs.readFileSync(path.join(tmp, 'ja.json'), 'utf8'))).length, Object.keys(en).length);
assert.ok(!pull('<!doctype html><html>sign in</html>').ok, 'a web page is refused');
assert.ok(!pull(`key,en,ja\n${first},"${en[first]}","x"\n`).ok, 'a sheet missing most keys is refused');
assert.ok(!pull('nope', 404).ok, 'an error status is refused');
assert.equal(Object.keys(JSON.parse(fs.readFileSync(path.join(tmp, 'ja.json'), 'utf8'))).length, Object.keys(en).length, 'refused pulls leave the files untouched');
fs.rmSync(tmp, { recursive: true, force: true });
void multi; void rows;

console.log(`PASS: i18n: ${Object.keys(en).length} English strings, every t() key exists with matching placeholders, no unused keys, no hardcoded text in text calls, language choice and fallbacks, Arabic right-to-left and CJK fonts, and the Google Sheets export/import round trip.`);
