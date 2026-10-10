import assert from 'node:assert/strict';
import fs from 'node:fs';
import { build } from 'esbuild';

// Live Google Sheet translations (test-build scaffold): CSV parsing, validation, cache fallback and runtime use.
const bundle = await build({
  stdin: { contents: "export * from './prototypes/punchies/src/i18n/liveSheet.ts'; export * from './prototypes/punchies/src/i18n/index.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, platform: 'node', format: 'esm', write: false,
});
const m = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const en = JSON.parse(fs.readFileSync('prototypes/punchies/src/i18n/locales/en.json', 'utf8'));
const keys = Object.keys(en).sort();
const withPlaceholder = keys.find((k) => /\{\w+\}/.test(en[k]));
const plain = keys.find((k) => !/\{\w+\}/.test(en[k]));
assert.ok(withPlaceholder && plain);
const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
const csv = (rows) => ['key,en,ja,ko,zh,es,ar,placeholders', ...rows.map((r) => r.map(q).join(','))].join('\r\n') + '\r\n';
const ph = (k) => (en[k].match(/\{(\w+)\}/g) ?? []).join(' ');
const fullRows = (ja) => keys.map((k) => [k, en[k], ja(k), '', '', '', '', ph(k)]);

// ---- CSV parsing: quotes, commas, newlines inside cells, CRLF
assert.deepEqual(m.parseCsv('a,"b,c","d ""e""\nf"\r\ng,h,i\n'), [['a', 'b,c', 'd "e"\nf'], ['g', 'h', 'i']]);
assert.equal(m.sheetUrl('ID123'), 'https://docs.google.com/spreadsheets/d/ID123/gviz/tq?tqx=out:csv');
assert.equal(m.sheetUrl('ID', 'Tab 1'), 'https://docs.google.com/spreadsheets/d/ID/gviz/tq?tqx=out:csv&sheet=Tab%201');

// ---- validation
{
  const rows = fullRows((k) => `JA:${en[k]}`);
  const iPh = keys.indexOf(withPlaceholder), iEmpty = keys.indexOf(plain);
  rows[iPh][2] = `JA:${en[withPlaceholder].replace(/\{(\w+)\}/g, '{ $1 }')}`; // translator added spaces: repaired
  const bad = keys.find((k, i) => i !== iPh && /\{\w+\}/.test(en[k]));
  if (bad) rows[keys.indexOf(bad)][2] = 'JA:broken {wrongname}'; // placeholder renamed: rejected
  rows[iEmpty][2] = ''; // empty cell: skipped
  rows[iEmpty + 1][2] = '#ERROR!'; // unfinished formula: skipped
  rows[iEmpty + 2][2] = 'Loading...';
  const { tables, issues } = m.tablesFromCsv(csv(rows));
  assert.equal(tables.ja[withPlaceholder], `JA:${en[withPlaceholder]}`, 'spaced placeholders are repaired');
  assert.ok(!(keys[iEmpty] in tables.ja) && !(keys[iEmpty + 1] in tables.ja) && !(keys[iEmpty + 2] in tables.ja));
  if (bad) { assert.ok(!(bad in tables.ja), 'a renamed placeholder is rejected'); assert.ok(issues.some((s) => s.includes(bad))); }
  assert.equal(tables.ko, undefined, 'languages with no translated cells produce no table');
}
assert.throws(() => m.tablesFromCsv('<!DOCTYPE html><html>sign in</html>'), /not shared/);
assert.throws(() => m.tablesFromCsv('a,b\n1,2\n'), /key" and "en"/);
assert.throws(() => m.tablesFromCsv(csv(fullRows(() => 'x').slice(0, 3))), /English keys/);

// ---- loader: live, then cache, then nothing
const memory = () => { const d = new Map(); return { getItem: (k) => d.get(k) ?? null, setItem: (k, v) => d.set(k, v) }; };
const okFetch = (text) => async () => ({ ok: true, status: 200, text: async () => text });
const store = memory();
const sheet = csv(fullRows((k) => `JA:${en[k]}`));
assert.equal(await m.installLiveTranslations({ store, cacheKey: 'c', fetchFn: okFetch(sheet), url: 'u' }), 'live');
assert.ok(JSON.parse(store.getItem('c')).tables.ja[plain]);
assert.ok(m.availableLanguages().some((l) => l.code === 'ja'), 'a language with live translations becomes selectable');
await m.setLanguage('ja');
assert.equal(m.t(plain), `JA:${en[plain]}`);
const params = Object.fromEntries([...en[withPlaceholder].matchAll(/\{(\w+)\}/g)].map((x) => [x[1], 7]));
assert.ok(m.t(withPlaceholder, params).includes('7'), 'placeholders are filled in live text');
assert.equal(m.t('no.such.key'), 'no.such.key');
await m.setLanguage('en');

m.setLiveTables({});
assert.equal(await m.installLiveTranslations({ store, cacheKey: 'c', fetchFn: async () => { throw new Error('offline'); }, url: 'u' }), 'cache');
assert.ok(m.availableLanguages().some((l) => l.code === 'ja'), 'the cache keeps the language available offline');
m.setLiveTables({});
assert.equal(await m.installLiveTranslations({ store, cacheKey: 'c', fetchFn: async () => ({ ok: false, status: 401, text: async () => '' }), url: 'u' }), 'cache', 'an unshared sheet falls back to the cache');
m.setLiveTables({});
assert.equal(await m.installLiveTranslations({ store: memory(), cacheKey: 'c', fetchFn: okFetch('<!DOCTYPE html>sign in'), url: 'u' }), 'none');
assert.ok(!m.availableLanguages().some((l) => l.code === 'ja'), 'with no live data and no cache only English is offered');
// a hung request is abandoned at the timeout
const hung = (_u, opts) => new Promise((_, reject) => opts.signal.addEventListener('abort', () => reject(new Error('aborted'))));
const t0 = Date.now();
assert.equal(await m.installLiveTranslations({ store, cacheKey: 'c', fetchFn: hung, url: 'u', timeoutMs: 40 }), 'cache');
assert.ok(Date.now() - t0 < 1500, 'boot is delayed by at most the timeout');
m.setLiveTables({});
console.log('PASS: live sheet translations: CSV parsing, placeholder repair/rejection, unfinished formulas skipped, unshared sheet and offline fall back to cache then bundled/English, timeout bounds boot delay, live languages selectable and used by t().');
