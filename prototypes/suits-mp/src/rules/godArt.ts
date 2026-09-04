import type { God, Team } from './types';

// Filename convention for the R2-fetched god/board art PNGs (see
// suits-mp_assets.zip's loose/ folder and the runtime asset manifest doc -
// exact filenames, verbatim, never renamed in code). Shared by every
// consumer of this art - the Phaser card compositor (ui/cardArt.ts) and any
// DOM chrome that also shows real god art (dom/overlay's suit symbols,
// RulesModal's cycle diagram) - so the god -> filename mapping has a single
// source of truth rather than being duplicated per consumer.
const GOD_SLUG: Record<God, string> = {
  Cthulhu: 'cthulhu',
  Nyarlathotep: 'nyarlathotep',
  ShubNiggurath: 'shub_niggurath',
  YogSothoth: 'yog_sothoth',
};

export function symbolArtFile(god: God): string {
  return `deity_symbol_${GOD_SLUG[god]}`;
}

export function faceArtFile(god: God): string {
  return `deity_face_${GOD_SLUG[god]}`;
}

export function frameArtFile(god: God): string {
  return `card_frame_${GOD_SLUG[god]}`;
}

// Team Chaos (Cthulhu, Nyarlathotep) and Team Cosmos (Shub-Niggurath,
// Yog-Sothoth) each have one shared rank-badge treatment - not per-god,
// unlike the frame/symbol/face art above.
export function rankBadgeArtFile(team: Team): string {
  return team === 'Chaos' ? 'rank_badge_chaos_portal' : 'rank_badge_cosmos_galaxy';
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
