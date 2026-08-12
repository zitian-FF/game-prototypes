// Pure fan-layout math, deliberately kept free of any Phaser/DOM dependency
// (matching ui/handLegality.ts and ui/seating.ts) so it can be unit-tested
// directly. Computes each card's position/rotation on an arc radiating from
// a pivot point below the visible fan, rather than a straight scrolling
// row - see BRIEF.md's "Card fan" section. All the tunable numbers below
// come from tune.json (root CLAUDE.md's "all values affecting game feel...
// live in tune.json" rule), passed in as `FanConfig` rather than imported
// directly, so this module stays a pure function of its inputs.

export interface FanConfig {
  // Degrees between adjacent cards for a small hand; the *total* spread is
  // this times (count - 1), capped at maxSpreadDeg so a full 13-card hand
  // doesn't fan out wider than the screen.
  perCardStepDeg: number;
  maxSpreadDeg: number;
  // Distance from the (offscreen, below-the-fan) pivot point to each
  // card's center.
  radius: number;
  cardWidth: number;
  cardHeight: number;
}

export interface FanCardLayout {
  x: number;
  y: number;
  rotationDeg: number;
}

// `pivotX`/`pivotY` is the point every card's arc radiates from - callers
// place it below the visible fan area so the cards curve upward, cupped
// like a hand of cards.
export function computeFanLayout(count: number, index: number, pivotX: number, pivotY: number, config: FanConfig): FanCardLayout {
  if (count <= 0) return { x: pivotX, y: pivotY - config.radius, rotationDeg: 0 };

  const totalSpreadDeg = count === 1 ? 0 : Math.min(config.maxSpreadDeg, config.perCardStepDeg * (count - 1));
  const stepDeg = count === 1 ? 0 : totalSpreadDeg / (count - 1);
  const angleDeg = count === 1 ? 0 : -totalSpreadDeg / 2 + stepDeg * index;
  const angleRad = (angleDeg * Math.PI) / 180;

  return {
    x: pivotX + config.radius * Math.sin(angleRad),
    y: pivotY - config.radius * Math.cos(angleRad),
    rotationDeg: angleDeg,
  };
}

export function computeFanLayouts(count: number, pivotX: number, pivotY: number, config: FanConfig): FanCardLayout[] {
  return Array.from({ length: count }, (_, i) => computeFanLayout(count, i, pivotX, pivotY, config));
}
