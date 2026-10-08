// Languages the game is (or will be) translated into. `native` is how the
// language names itself in the picker. Chinese is Simplified (zh).
export const LANGUAGES = [
  { code: 'en', native: 'English', rtl: false },
  { code: 'ja', native: '日本語', rtl: false },
  { code: 'ko', native: '한국어', rtl: false },
  { code: 'zh', native: '中文', rtl: false },
  { code: 'es', native: 'Español', rtl: false },
  { code: 'ar', native: 'العربية', rtl: true },
] as const;

export type LangCode = (typeof LANGUAGES)[number]['code'];
export const PSEUDO = 'pseudo';

export function isLangCode(v: unknown): v is LangCode {
  return LANGUAGES.some((l) => l.code === v);
}

/** Maps a browser or portal locale such as "ja-JP", "zh-CN" or "es_419" to one of our codes (or null). */
export function matchLocale(locale: string | null | undefined): LangCode | null {
  if (!locale) return null;
  const base = locale.toLowerCase().replace('_', '-').split('-')[0];
  return isLangCode(base) ? base : null;
}
