import { initPortal } from './portal/index';
import { initLanguage } from './i18n/init';

// Portal first (SDK + saved data), then the game: modules that read saved
// settings when they load (audio mixer, shop) must run after the preload.
void initPortal().then(initLanguage).then(() => import('./boot'));
