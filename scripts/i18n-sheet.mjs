#!/usr/bin/env node
// Punchies translations <-> Google Sheets.
//   node scripts/i18n-sheet.mjs export [out.csv] [--formulas]   English + every language column
//   node scripts/i18n-sheet.mjs import <downloaded.csv>          write locales/*.json from the sheet
//   node scripts/i18n-sheet.mjs pull <csv-url>                   download the published sheet, then import (also reads I18N_SHEET_URL)
//   node scripts/i18n-sheet.mjs check                            validate all locale files
// In Sheets: File > Import the CSV. With --formulas the empty cells hold
// =GOOGLETRANSLATE(...) so Sheets fills them; review them (Chinese is reviewed by the owner),
// then File > Download > CSV and run `import`. Placeholders such as {name} must survive.
import fs from 'node:fs';
import path from 'node:path';

const dir = process.env.I18N_DIR ?? 'prototypes/punchies/src/i18n/locales';
const LANGS = ['ja', 'ko', 'zh', 'es', 'ar'];
const GT = { ja: 'ja', ko: 'ko', zh: 'zh-CN', es: 'es', ar: 'ar' };
const read = (code) => {
  const table=JSON.parse(fs.readFileSync(path.join(dir, `${code}.json`), 'utf8'));
  const tuneFile=process.env.I18N_TUNE??(process.env.I18N_DIR?null:'prototypes/punchies/tune.json');
  if(code==='en'&&tuneFile&&fs.existsSync(tuneFile)){
    const texts=JSON.parse(fs.readFileSync(tuneFile,'utf8')).balanceWorkshop?.archetypes??{};
    for(const [key,value] of Object.entries(texts))if(/^char\.[a-z]+\.nick$/.test(key)&&key in table&&typeof value==='string')table[key]=value;
  }
  return table;
};
const write = (code, obj) => fs.writeFileSync(path.join(dir, `${code}.json`), JSON.stringify(Object.fromEntries(Object.entries(obj).sort()), null, 2) + '\n');
const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
// Sheets' translator sometimes writes "{ name }" with spaces: repair before validating.
const repair = (s) => s.replace(/\{\s*(\w+)\s*\}/g, '{$1}');

function csvEscape(v) { return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; }
function parseCsv(text) {
  const rows = []; let row = []; let cell = ''; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false; } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function exportSheet(out, formulas) {
  const en = read('en');
  const tables = Object.fromEntries(LANGS.map((c) => [c, read(c)]));
  const header = ['key', 'en', ...LANGS, 'placeholders'];
  const lines = [header.join(',')];
  Object.keys(en).sort().forEach((key, i) => {
    const row = i + 2;
    const cells = [key, en[key], ...LANGS.map((c, j) => {
      if (tables[c][key]) return tables[c][key];
      return formulas ? `=GOOGLETRANSLATE(B${row},"en","${GT[c]}")` : '';
    }), placeholders(en[key]).replaceAll(',', ' ')];
    lines.push(cells.map((v) => csvEscape(String(v))).join(','));
  });
  fs.writeFileSync(out, lines.join('\n') + '\n');
  console.log(`exported ${Object.keys(en).length} strings to ${out}`);
}

function importSheet(file) { importText(fs.readFileSync(file, 'utf8')); }

// File > Share > Publish to web > Sheet > CSV gives a URL anyone can read. The
// game never fetches it: translations are frozen into locales/*.json at pull time.
async function pullSheet(url) {
  if (!/^https:\/\/docs\.google\.com\//.test(url ?? '')) throw new Error('give the published Google Sheets CSV address (https://docs.google.com/...)');
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`the sheet answered ${res.status}`);
  const text = await res.text();
  // A sign-in or error page comes back as HTML: never import that.
  if (/^\s*<(!doctype|html)/i.test(text)) throw new Error('the address returned a web page, not CSV (is the sheet published to the web as CSV?)');
  importText(text, true);
}

function importText(text, whole = false) {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('the sheet is empty');
  const header = rows[0];
  const col = Object.fromEntries(header.map((h, i) => [h.trim(), i]));
  if (col.key === undefined || col.en === undefined) throw new Error('the sheet needs "key" and "en" columns');
  const en = read('en');
  const known = rows.slice(1).filter((r) => r[col.key] in en).length;
  if (whole && known < Object.keys(en).length / 2) throw new Error(`only ${known} of ${Object.keys(en).length} English keys are in the sheet, refusing to import`);
  const issues = [];
  const result = Object.fromEntries(LANGS.map((c) => [c, {}]));
  for (const r of rows.slice(1)) {
    const key = r[col.key];
    if (!key) continue;
    if (!(key in en)) { issues.push(`${key}: not an English key (row ignored)`); continue; }
    for (const c of LANGS) {
      if (col[c] === undefined) continue;
      const raw = (r[col[c]] ?? '').trim();
      if (!raw) continue;
      const value = repair(raw);
      if (placeholders(value) !== placeholders(en[key])) { issues.push(`${c} ${key}: placeholders ${placeholders(value) || 'none'} do not match ${placeholders(en[key]) || 'none'} (kept English)`); continue; }
      result[c][key] = value;
    }
  }
  const coverage = {};
  for (const c of LANGS) {
    if (col[c] === undefined) { coverage[c] = Object.keys(read(c)).length; continue; }
    write(c, result[c]);
    coverage[c] = Object.keys(result[c]).length;
  }
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(Object.fromEntries(Object.entries(coverage).filter(([, n]) => n > 0)), null, 2) + '\n');
  console.log('coverage (strings translated):', JSON.stringify(coverage), `of ${Object.keys(en).length}`);
  if (issues.length) console.log(`${issues.length} issue(s):\n- ${issues.join('\n- ')}`);
}

function check() {
  const en = read('en');
  const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
  const problems = [];
  for (const c of LANGS) {
    const table = read(c);
    for (const [key, value] of Object.entries(table)) {
      if (!(key in en)) problems.push(`${c}: unknown key ${key}`);
      else if (placeholders(value) !== placeholders(en[key])) problems.push(`${c}: ${key} placeholders differ from English`);
    }
    const n = Object.keys(table).length;
    if ((index[c] ?? 0) !== n) problems.push(`${c}: locales/index.json says ${index[c] ?? 0} but the file has ${n}`);
  }
  if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
  console.log('locale files OK');
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'pull') pullSheet(arg ?? process.env.I18N_SHEET_URL).catch((e) => { console.error(e.message); process.exit(1); });
else if (cmd === 'export') exportSheet(arg && !arg.startsWith('--') ? arg : 'punchies-translations.csv', process.argv.includes('--formulas'));
else if (cmd === 'import' && arg) importSheet(arg);
else if (cmd === 'check') check();
else { console.error('usage: i18n-sheet.mjs export [out.csv] [--formulas] | import <csv> | pull <csv-url> | check'); process.exit(2); }
