import type { SeatPosition } from '../../ui/seating';
import type { God } from '../../rules/types';

// Ported from the Claude Design handoff (`Suit of Madness Overlay.dc.html`).
// Seat keys reuse ui/seating.ts's SeatPosition ('top'|'right'|'bottom'|
// 'left') rather than the design's own "p1".."p4" labels, since those are
// arbitrary design-tool names for the same four egocentric positions
// seating.ts already defines (p1=top, p2=right, p3=bottom/you, p4=left -
// same clockwise order as SEAT_BY_OFFSET).

export const SEAT_ORDER: readonly SeatPosition[] = ['top', 'right', 'bottom', 'left'];

// Degrees the turn-indicator wheel's pointer rotates to when it's each
// seat's turn - clockwise from the top, matching seating.ts's own
// clockwise seat order.
export const SEAT_DEG: Record<SeatPosition, number> = { top: 0, right: 90, bottom: 180, left: 270 };

export interface SuitInfo {
  code: string;
  name: string;
  short: string;
}

// Fixed suit-cycle order (Yog-Sothoth -> Cthulhu -> Shub-Niggurath ->
// Nyarlathotep), matching rules/cards.ts's real cycle and the Rules
// modal's own CYCLE data (dom/rulesContent.ts) for the same order. The
// design's own 2-letter codes (YS/CT/SN/NY) are kept as-is rather than
// switched to rules/cards.ts's GOD_ABBR (3-letter: YOG/CTH/SHU/NYA) -
// pixel fidelity to the source design wins here since both are just
// abbreviations of the same real god.
export const SUITS: SuitInfo[] = [
  { code: 'YS', name: 'Yog-Sothoth', short: 'Yog-S.' },
  { code: 'CT', name: 'Cthulhu', short: 'Cthulhu' },
  { code: 'SN', name: 'Shub-Niggurath', short: 'Shub-N.' },
  { code: 'NY', name: 'Nyarlathotep', short: 'Nyarl.' },
];

// This suit cycle's position for each real god - index into SUITS above.
export const GOD_TO_SUIT_INDEX: Record<God, number> = {
  YogSothoth: 0,
  Cthulhu: 1,
  ShubNiggurath: 2,
  Nyarlathotep: 3,
};
