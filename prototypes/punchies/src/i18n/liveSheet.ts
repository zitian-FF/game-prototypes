import en from './locales/en.json';
import { LANGUAGES, type LangCode } from './languages';
import { setLiveTables, type LiveTables } from './index';
import config from './liveSheet.json';

// Test-build scaffold: read translations straight from the live Google Sheet, so a fix in the sheet shows up
// on the next load with no deploy. The sheet must be shared "anyone with the link can view". The final build
// ships the frozen locales/*.json instead (see docs/release-plan.md, section 8b), so this file is removed then.
// Fallback chain: live sheet, then the cache from the last good fetch, then the bundled files, then English.

const english = en as Record<string, string>;
const placeholders = (s: string): string => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
// Sheets' translator sometimes writes "{ name }" with spaces: repair before validating.
const repair = (s: string): string => s.replace(/\{\s*(\w+)\s*\}/g, '{$1}');

export function sheetUrl(sheetId: string, tab = ''): string {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv${tab ? `&sheet=${encodeURIComponent(tab)}` : ''}`;
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
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

/** Turns the sheet's CSV into one table per language. Rows that break the rules are skipped, never half-applied. */
export function tablesFromCsv(text: string): { tables: LiveTables; issues: string[] } {
  const issues: string[] = [];
  if (/^\s*<(!doctype|html)/i.test(text)) throw new Error('the sheet is not shared for viewing (got a web page, not CSV)');
  const rows = parseCsv(text);
  const header = rows[0]?.map((h) => h.trim()) ?? [];
  const col = Object.fromEntries(header.map((h, i) => [h, i])) as Record<string, number>;
  if (col.key === undefined || col.en === undefined) throw new Error('the sheet needs "key" and "en" columns');
  const known = rows.slice(1).filter((r) => (r[col.key] ?? '') in english).length;
  if (known < Object.keys(english).length / 2) throw new Error(`only ${known} of ${Object.keys(english).length} English keys are in the sheet`);
  const tables: LiveTables = {};
  for (const r of rows.slice(1)) {
    const key = r[col.key];
    if (!key || !(key in english)) continue;
    for (const lang of LANGUAGES) {
      if (lang.code === 'en' || col[lang.code] === undefined) continue;
      const raw = (r[col[lang.code]] ?? '').trim();
      if (!raw || raw.startsWith('#') || /^Loading/i.test(raw)) continue; // empty cell or an unfinished formula
      const value = repair(raw);
      if (placeholders(value) !== placeholders(english[key])) { issues.push(`${lang.code} ${key}: placeholders differ from English`); continue; }
      (tables[lang.code] ??= {})[key] = value;
    }
  }
  return { tables, issues };
}

interface Cache { at: number; tables: LiveTables }
export interface LiveDeps {
  store: { getItem(key: string): string | null; setItem(key: string, value: string): void };
  cacheKey: string;
  fetchFn?: typeof fetch;
  url?: string;
  timeoutMs?: number;
  now?: () => number;
}

async function fetchTables(url: string, timeoutMs: number, fetchFn: typeof fetch): Promise<LiveTables> {
  const ctl = typeof AbortController === 'undefined' ? null : new AbortController();
  const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
  try {
    const res = await fetchFn(url, { signal: ctl?.signal, cache: 'no-store' });
    if (!res.ok) throw new Error(`the sheet answered ${res.status}`);
    return tablesFromCsv(await res.text()).tables;
  } finally { if (timer) clearTimeout(timer); }
}

/** Boot hook. Never throws and never delays boot beyond the timeout: any failure falls back to the cache or the bundled files. */
export async function installLiveTranslations(deps: LiveDeps): Promise<'live' | 'cache' | 'none'> {
  const timeoutMs = deps.timeoutMs ?? config.timeoutMs;
  const fetchFn = deps.fetchFn ?? (typeof fetch === 'undefined' ? undefined : fetch);
  const url = deps.url ?? sheetUrl(config.sheetId, config.tab);
  let cached: Cache | null = null;
  try { cached = JSON.parse(deps.store.getItem(deps.cacheKey) ?? 'null') as Cache | null; } catch { cached = null; }
  if (fetchFn) {
    try {
      const tables = await fetchTables(url, timeoutMs, fetchFn);
      if (Object.keys(tables).length) {
        setLiveTables(tables);
        try { deps.store.setItem(deps.cacheKey, JSON.stringify({ at: (deps.now ?? Date.now)(), tables } satisfies Cache)); } catch { /* storage full */ }
        return 'live';
      }
    } catch { /* offline, not shared or bad sheet: use the cache */ }
  }
  if (cached?.tables) { setLiveTables(cached.tables); return 'cache'; }
  return 'none';
}

export type { LangCode };
