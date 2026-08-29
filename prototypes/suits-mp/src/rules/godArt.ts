import type { God } from './types';

// Filename convention for the 8 R2-fetched god art PNGs (see
// suits-mp_assets.zip's loose/ folder: symbol_<n>_<slug>.png and
// face_<n>_<slug>.png). Shared by every consumer of this art - the
// Phaser card-frame compositor (ui/cardArt.ts) and any DOM chrome that
// also shows real god art (dom/overlay's suit symbols) - so the god ->
// filename mapping has a single source of truth rather than being
// duplicated per consumer.
const GOD_ART_SLUG: Record<God, string> = {
  Cthulhu: '1_cthulhu',
  Nyarlathotep: '2_nyarlathotep',
  ShubNiggurath: '3_shub-niggurath',
  YogSothoth: '4_yog-sothoth',
};

export function symbolArtFile(god: God): string {
  return `symbol_${GOD_ART_SLUG[god]}`;
}

export function faceArtFile(god: God): string {
  return `face_${GOD_ART_SLUG[god]}`;
}

// Team Chaos (Cthulhu, Nyarlathotep) uses the hexagonal motif; Team Cosmos
// (Shub-Niggurath, Yog-Sothoth) uses the circular motif - fixed per the
// Card Frame design handoff, reused everywhere a god's art needs a
// matching backing shape (the card frame itself, and now the DOM suit
// symbol badges).
export const GOD_MOTIF: Record<God, 'hex' | 'circle'> = {
  Cthulhu: 'hex',
  Nyarlathotep: 'hex',
  ShubNiggurath: 'circle',
  YogSothoth: 'circle',
};
