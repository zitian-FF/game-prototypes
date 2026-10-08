import fs from 'node:fs';

// English-only stand-in for src/i18n in tests that load game modules by hand.
const en = JSON.parse(fs.readFileSync('prototypes/punchies/src/i18n/locales/en.json', 'utf8'));
const fill = (s, p) => (p ? s.replace(/\{(\w+)\}/g, (w, n) => (n in p ? String(p[n]) : w)) : s);
export const i18nStub = {
  t: (key, params) => fill(en[key] ?? key, params),
  tOr: (key, fallback, params) => fill(en[key] ?? fallback, params),
  getLanguage: () => 'en',
  isRtl: () => false,
};
