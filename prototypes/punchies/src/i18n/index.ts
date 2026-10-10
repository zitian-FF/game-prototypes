import { isLangCode, LANGUAGES, matchLocale, PSEUDO, type LangCode } from './languages';
import en from './locales/en.json';

// Translation layer. Game code calls t('area.key', { name: value }); the table
// for the current language is looked up, then English, then the key itself.
// Placeholders are written {name}. Translations live in locales/<code>.json and
// are exchanged with a Google Sheet by scripts/i18n-sheet.mjs. A language is only
// offered in the picker once locales/index.json says it has translations.

export type Params = Record<string, string | number>;
type Table = Record<string, string>;
export type Coverage = Partial<Record<LangCode, number>>;
export type LiveTables = Partial<Record<LangCode, Table>>;

const english = en as Table;
let table: Table = english;
let current: LangCode | typeof PSEUDO = 'en';
let loader: (code: LangCode) => Promise<Table> = async () => ({});
let coverage: Coverage = {};
let live: LiveTables = {};
const listeners = new Set<(code: LangCode | typeof PSEUDO) => void>();

export function setLocaleLoader(fn: (code: LangCode) => Promise<Table>, cov: Coverage): void {
  loader = fn;
  coverage = cov;
}

/** Test-build scaffold: translations read from the live Google Sheet. They win over the bundled files and make a language selectable. */
export function setLiveTables(tables: LiveTables): void {
  live = tables;
}

const covered = (code: LangCode): boolean => (coverage[code] ?? 0) > 0 || Object.keys(live[code] ?? {}).length > 0;

function fill(text: string, params?: Params): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole));
}

export function t(key: string, params?: Params): string {
  const raw = current === PSEUDO ? (english[key] ?? key) : (table[key] ?? english[key] ?? key);
  const out = fill(raw, params);
  // Right-to-left languages: an RTL embedding makes the canvas place punctuation and numbers correctly
  // without changing where the text sits (no layout mirroring).
  if (isRtl()) return `\u202B${out}\u202C`;
  // Pseudo-locale (?lang=pseudo): wraps every translated string so hardcoded English stands out on screen.
  return current === PSEUDO ? `⟦${out}⟧` : out;
}

/** Like t(), but returns `fallback` (not the key) when no language has the key, for data that carries its own English text. */
export function tOr(key: string, fallback: string, params?: Params): string {
  const has = key in english || (current !== PSEUDO && key in table);
  return has ? t(key, params) : fill(fallback, params);
}

export function getLanguage(): LangCode | typeof PSEUDO { return current; }
export function isRtl(): boolean { return LANGUAGES.find((l) => l.code === current)?.rtl ?? false; }

/** English plus every language that has translations. The picker only appears when this has more than one entry. */
export function availableLanguages(includeAll = false): readonly (typeof LANGUAGES)[number][] {
  return LANGUAGES.filter((l) => l.code === 'en' || includeAll || covered(l.code));
}

export async function setLanguage(code: LangCode | typeof PSEUDO): Promise<void> {
  let next: Table = english;
  if (code !== 'en' && code !== PSEUDO) {
    let bundled: Table = {};
    try { bundled = await loader(code); } catch { bundled = {}; }
    next = { ...bundled, ...(live[code] ?? {}) };
  }
  table = next;
  current = code;
  listeners.forEach((fn) => fn(code));
}

export function onLanguageChange(fn: (code: LangCode | typeof PSEUDO) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Saved choice, then the portal's language, then the browser's; only languages that have translations are chosen automatically. */
export function pickInitialLanguage(saved: string | null, portalLocale: string | null, browserLocale: string | null, search = ''): LangCode | typeof PSEUDO {
  const forced = new URLSearchParams(search).get('lang');
  if (forced === PSEUDO) return PSEUDO;
  if (isLangCode(forced)) return forced;
  const usable = (c: LangCode | null): c is LangCode => c !== null && (c === 'en' || covered(c));
  if (isLangCode(saved) && usable(saved)) return saved;
  for (const locale of [portalLocale, browserLocale]) {
    const m = matchLocale(locale);
    if (usable(m)) return m;
  }
  return 'en';
}
