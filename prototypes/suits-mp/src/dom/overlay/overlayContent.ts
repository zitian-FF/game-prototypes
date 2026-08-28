import type { SeatPosition } from '../../ui/seating';

// Ported from the Claude Design handoff (`Suit of Madness Overlay.dc.html`).
// Placeholder-data only, per this task's brief - see GameOverlay.tsx's
// header comment and BUILD_STATUS.md for what's real vs. placeholder.
//
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
// Nyarlathotep), matching rules/cards.ts's real cycle - see the Rules
// modal's own SECTIONS/CYCLE data (dom/rulesContent.ts) for the same
// order ported for that screen.
export const SUITS: SuitInfo[] = [
  { code: 'YS', name: 'Yog-Sothoth', short: 'Yog-S.' },
  { code: 'CT', name: 'Cthulhu', short: 'Cthulhu' },
  { code: 'SN', name: 'Shub-Niggurath', short: 'Shub-N.' },
  { code: 'NY', name: 'Nyarlathotep', short: 'Nyarl.' },
];

// Placeholder display names for the name tags - not real roster/player
// data (see BUILD_STATUS.md's "Open questions" for the real-state-wiring
// follow-up this defers to).
export const PLACEHOLDER_NAMES: Record<SeatPosition, string> = {
  top: 'Abdul A.',
  right: 'Erich Z.',
  bottom: 'Randolph C.',
  left: 'Lavinia W.',
};
