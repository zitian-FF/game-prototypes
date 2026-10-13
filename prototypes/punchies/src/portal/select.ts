import { crazyGamesPortal } from './crazygames';
import { playgamaPortal } from './playgama';
import { pokiPortal } from './poki';
import { webPortal } from './web';
import type { Portal } from './types';

// Chosen at build time: `PORTAL=crazygames npm run build` (default: web).
// `PORTAL_ADS=off` builds a portal version with no rewarded ads (for example
// CrazyGames' Basic Launch, where ads are disabled).
declare const __PUNCHIES_PORTAL__: string;
declare const __PUNCHIES_PORTAL_ADS__: boolean;

// Plain if-chains on build-time constants, so the bundler drops every adapter the
// build does not use (a default build carries no portal SDK address at all).
function pick(): Portal {
  if (__PUNCHIES_PORTAL__ === 'crazygames') return crazyGamesPortal(__PUNCHIES_PORTAL_ADS__);
  if (__PUNCHIES_PORTAL__ === 'poki') return pokiPortal(__PUNCHIES_PORTAL_ADS__);
  if (__PUNCHIES_PORTAL__ === 'playgama') return playgamaPortal(__PUNCHIES_PORTAL_ADS__);
  return webPortal();
}

export const portal: Portal = pick();
