import { portal } from '../portal/select';
import { store } from '../portal/store';
import { KEYS } from '../portal/keys';
import { installLocaleLoader } from './loaders';
import { installLiveTranslations } from './liveSheet';
import { TEST_BUILD } from '../testBuild';
import { pickInitialLanguage, setLanguage } from './index';
import type { LangCode } from './languages';

/** Called once at boot, after the portal and saved data are ready and before any game module loads. */
export async function initLanguage(): Promise<void> {
  installLocaleLoader();
  // Test-build scaffold: translations from the live Google Sheet. ?live=0 turns it off.
  if (TEST_BUILD && !(typeof location !== 'undefined' && new URLSearchParams(location.search).get('live') === '0')) {
    await installLiveTranslations({ store, cacheKey: KEYS.liveTranslations });
  }
  let portalLocale: string | null = null;
  try { portalLocale = portal.locale?.() ?? null; } catch { /* portal has no language */ }
  const browser = typeof navigator === 'undefined' ? null : navigator.language;
  const search = typeof location === 'undefined' ? '' : location.search;
  await setLanguage(pickInitialLanguage(store.getItem(KEYS.language), portalLocale, browser, search));
}

/** The player's choice from the language button: apply it and remember it. */
export async function chooseLanguage(code: LangCode): Promise<void> {
  store.setItem(KEYS.language, code);
  await setLanguage(code);
}
