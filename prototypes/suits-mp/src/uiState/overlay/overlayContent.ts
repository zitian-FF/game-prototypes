import type { SeatPosition } from '../../ui/seating';
import type { God } from '../../rules/types';

// Ported from the Claude Design handoff (`Suit of Madness Overlay.dc.html`).
// Seat keys reuse ui/seating.ts's SeatPosition ('top'|'right'|'bottom'|
// 'left') rather than the design's own "p1".."p4" labels, since those are
// arbitrary design-tool names for the same four egocentric positions
// seating.ts already defines (p1=top, p2=right, p3=bottom/you, p4=left -
// same clockwise order as SEAT_BY_OFFSET).

export const SEAT_ORDER: readonly SeatPosition[] = ['top', 'right', 'bottom', 'left'];

// Clockwise screen angle for each seat, local-top = 0deg - the same
// correspondence GameOverlay.tsx's turn-indicator pointer already uses via
// SEAT_ORDER's own order (index*90deg). Used by the Suit Cycle HUD's own
// bezel rotation to bring the current trick's lead suit to the actual
// seat of whoever led it, rather than a fixed screen position - see
// GameOverlay.tsx's `suitDeg` computation.
export const SEAT_DEG: Record<SeatPosition, number> = {
  top: 0,
  right: 90,
  bottom: 180,
  left: 270,
};

export interface SuitInfo {
  code: string;
  name: string;
  short: string;
  god: God;
}

// Fixed suit-cycle order (Yog-Sothoth -> Cthulhu -> Shub-Niggurath ->
// Nyarlathotep), matching rules/cards.ts's real cycle and the Rules
// modal's own CYCLE data (dom/rulesContent.ts) for the same order. The
// design's own 2-letter codes (YS/CT/SN/NY) are kept as-is rather than
// switched to rules/cards.ts's GOD_ABBR (3-letter: YOG/CTH/SHU/NYA) -
// pixel fidelity to the source design wins here since both are just
// abbreviations of the same real god. `code`/`short` still back the few
// remaining text-only spots (aria labels, the Lead-suit name); the
// visual suit badges themselves now render `god`'s real symbol art
// instead (see dom/godArtUrl.ts).
export const SUITS: SuitInfo[] = [
  { code: 'YS', name: 'Yog-Sothoth', short: 'Yog-S.', god: 'YogSothoth' },
  { code: 'CT', name: 'Cthulhu', short: 'Cthulhu', god: 'Cthulhu' },
  { code: 'SN', name: 'Shub-Niggurath', short: 'Shub-N.', god: 'ShubNiggurath' },
  { code: 'NY', name: 'Nyarlathotep', short: 'Nyarl.', god: 'Nyarlathotep' },
];

// This suit cycle's position for each real god - index into SUITS above.
export const GOD_TO_SUIT_INDEX: Record<God, number> = {
  YogSothoth: 0,
  Cthulhu: 1,
  ShubNiggurath: 2,
  Nyarlathotep: 3,
};
