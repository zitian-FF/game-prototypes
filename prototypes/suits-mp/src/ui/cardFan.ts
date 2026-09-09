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

// A rotated rectangle's own axis-aligned bounding-box half-width - the
// real on-screen horizontal reach of a card tilted by `rotationDeg`, not
// just where its center sits. Exported so callers (and any verification
// tooling) can compute a card's real rendered edge without duplicating
// this formula.
export function rotatedHalfWidth(cardWidth: number, cardHeight: number, rotationDeg: number): number {
  const rad = (rotationDeg * Math.PI) / 180;
  return (cardWidth / 2) * Math.abs(Math.cos(rad)) + (cardHeight / 2) * Math.abs(Math.sin(rad));
}

export interface FanBoundsConfig {
  // Full screen/canvas width the fan must stay inside.
  screenWidth: number;
  // Minimum on-screen gap kept between a card's outermost rendered edge
  // and the screen edge, on both sides.
  edgeMarginPx: number;
}

// `maxSpreadDeg` (in FanConfig) only ever bounded where card *centers*
// sit - it says nothing about where a tilted card's actual rendered
// corners land, which depends on cardWidth/cardHeight/rotation together
// (see `rotatedHalfWidth` above). Once a hand gets big enough (redistri-
// bution can temporarily inflate a hand well past its normal 10 cards -
// see BUILD_STATUS.md), the outermost cards' real edges can run off
// either side of the screen even though their centers stay within
// `maxSpreadDeg`.
//
// This computes a single uniform scale (<=1) to apply to BOTH `radius`
// and the card's own display size together, so the outermost card's real
// edge lands at or inside `edgeMarginPx` from the screen edge. Scaling
// radius and card size together - rather than only one of them, or the
// spread angle - reads as the whole fan "zooming out" as the hand grows
// (cards sit closer together AND get a little smaller) instead of either
// flattening the arc's shape (radius-only) or shrinking cards out of
// proportion to their own spacing (card-size-only). It only ever
// compacts, never enlarges: whenever the unscaled config already fits
// (typically true for small hands), this returns exactly `1`, so a hand
// size that was already safe renders completely unchanged.
//
// `config.cardWidth`/`cardHeight` should already reflect the *largest*
// size any card in this fan could render at (e.g. including a selected/
// popped-out card's own extra scale-up), since the edge invariant must
// hold for every card, not just the resting-state ones.
export function computeFanScale(count: number, pivotX: number, config: FanConfig, bounds: FanBoundsConfig): number {
  if (count <= 1) return 1;

  const totalSpreadDeg = Math.min(config.maxSpreadDeg, config.perCardStepDeg * (count - 1));
  const outerAngleDeg = totalSpreadDeg / 2;
  const outerAngleRad = (outerAngleDeg * Math.PI) / 180;
  const baseExtent = config.radius * Math.sin(outerAngleRad) + rotatedHalfWidth(config.cardWidth, config.cardHeight, outerAngleDeg);

  // Fan is symmetric about the pivot (angles range ±outerAngleDeg), so the
  // available room is whichever side of the pivot is tighter against the
  // screen edge.
  const budget = Math.min(pivotX, bounds.screenWidth - pivotX) - bounds.edgeMarginPx;
  if (baseExtent <= 0 || budget <= 0) return 1;

  return Math.min(1, budget / baseExtent);
}
