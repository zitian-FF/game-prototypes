import { symbolArtFile } from '../rules/godArt';
import type { God } from '../rules/types';

// Resolves a god's symbol PNG (see rules/godArt.ts) to a URL an `<img>`
// tag can load directly. This DOM layer is mounted into the same page as
// the Phaser canvas (dom/mountDom.tsx), which already loads
// prototypes/suits-mp/assets/loose/<file>.png-relative art for the card
// frame compositor (ui/cardArt.ts) via the exact same relative path
// convention - the browser resolves both against the same document, so
// reusing it here needs no separate fetch/manifest plumbing of its own.
// Never key on filename for *caching* (scripts/fetch-assets.js's ETag
// cache already covers that at build time) - this is just the fixed,
// known-in-advance relative URL to an asset that pipeline already
// produced into prototypes/suits-mp/public/assets/loose/.
export function symbolArtUrl(god: God): string {
  return `assets/loose/${symbolArtFile(god)}.png`;
}

// A regular hexagon, apex at top-center, side vertices at ~20%/80% height -
// the exact same proportions as ui/cardArt.ts's hexPolygon(). Shared by
// every DOM spot that backs a Team Chaos god's symbol with a hex badge
// (GameOverlay.tsx's Suit Cycle HUD, RulesModal.tsx's cycle diagram) so
// they all read as the same motif as the card frames.
export const HEX_CLIP_PATH = 'polygon(50% 0%, 100% 19.95%, 100% 80.05%, 50% 100%, 0% 80.05%, 0% 19.95%)';
