/// <reference types="vite/client" />
import { setLocaleLoader, type Coverage } from './index';
import coverage from './locales/index.json';
import type { LangCode } from './languages';

// Vite-only: lazy per-language tables, so a player only downloads their own.
const files = import.meta.glob('./locales/*.json') as Record<string, () => Promise<{ default: Record<string, string> }>>;

export function installLocaleLoader(): void {
  setLocaleLoader(async (code: LangCode) => {
    const load = files[`./locales/${code}.json`];
    return load ? (await load()).default : {};
  }, coverage as Coverage);
}
