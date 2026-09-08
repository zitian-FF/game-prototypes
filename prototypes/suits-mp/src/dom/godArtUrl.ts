import { symbolArtFile } from '../rules/godArt';
import type { God } from '../rules/types';

// Resolves a god's symbol art (see rules/godArt.ts) to a URL an `<img>`
// tag can load directly. This DOM layer is mounted into the same page as
// the Phaser canvas (dom/mountDom.tsx), which already loads
// prototypes/suits-mp/assets/loose/<file>-relative art for the card frame
// compositor (ui/cardArt.ts) via the exact same relative path convention -
// the browser resolves both against the same document, so reusing it here
// needs no separate fetch/manifest plumbing of its own. Never key on
// filename for *caching* (scripts/fetch-assets.js's ETag cache already
// covers that at build time) - this is just the fixed, known-in-advance
// relative URL to an asset that pipeline already produced into
// prototypes/suits-mp/public/assets/loose/.
//
// The .webp extension here (and on actionSlabUrl/nameplateUrl below) is
// hardcoded to match scripts/pack-assets.js's IMAGE_OPTIMIZATION_RULES,
// which currently re-encodes every suits-mp loose asset to WebP - unlike
// the canvas loader (ui/cardArt.ts's queueLooseImages(), which is
// extension-agnostic via the manifest), these DOM URLs are constructed
// directly rather than looked up, so they need to be kept in sync by hand
// if that pipeline's output format ever changes again.
export function symbolArtUrl(god: God): string {
  return `assets/loose/${symbolArtFile(god)}.webp`;
}

// Carved black-and-gold button frame family (Menu/Set/Log utility buttons,
// the primary Play Card action button) - one shared asset, same relative-
// URL convention as symbolArtUrl above.
export function actionSlabUrl(): string {
  return 'assets/loose/ui_action_slab.webp';
}

// Player nameplate background, shared by every seat tag (local and
// opponent alike) - same convention as symbolArtUrl above.
export function nameplateUrl(): string {
  return 'assets/loose/ui_player_nameplate.webp';
}

// Center HUD: fixed carved-stone bezel (four circular recesses, open
// center) and the rotating current-turn pointer - same convention as
// symbolArtUrl above.
export function suitCycleBezelUrl(): string {
  return 'assets/loose/ui_suit_cycle_bezel.webp';
}

export function currentTurnPointerUrl(): string {
  return 'assets/loose/ui_current_turn_pointer.webp';
}

// A regular hexagon, apex at top-center, side vertices at ~20%/80% height -
// the exact same proportions as ui/cardArt.ts's hexPolygon(). Shared by
// every DOM spot that backs a Team Chaos god's symbol with a hex badge
// (GameOverlay.tsx's Suit Cycle HUD, RulesModal.tsx's cycle diagram) so
// they all read as the same motif as the card frames.
export const HEX_CLIP_PATH = 'polygon(50% 0%, 100% 19.95%, 100% 80.05%, 50% 100%, 0% 80.05%, 0% 19.95%)';
