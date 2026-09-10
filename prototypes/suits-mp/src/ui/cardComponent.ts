import Phaser from 'phaser';
import { cardById } from '../rules/cards';
import type { CardId, DeityCardState } from '../rules/types';
import { buildCard } from './cardArt';

// The one place any card - hand fan, play areas, redistribution stacks,
// previous-trick log - gets drawn, per the Stage 3a amendment's "unified
// card component" requirement: no per-context rendering logic. Content
// (face/back/empty) and style (colors) are entirely caller-supplied,
// keeping this module itself dumb/reusable - callers own what a given
// visual state *means* (legal/illegal/selected/assigned/etc.), this only
// owns how a card *looks* once that's decided. Faceup cards render real
// composited art (see ui/cardArt.ts); facedown cards render the real,
// complete `card_back.png` (2026-09-10 player-UI-asset-wave handoff) -
// applies uniformly to every facedown context this shared component
// serves (off-suit plays, and the redistribution-stack progress slots,
// which already reused this same `{kind:'facedown'}` branch before this
// task) rather than special-casing just the off-suit-play spot the
// handoff named explicitly - see BUILD_STATUS.md. Empty slots stay a
// placeholder primitive (no card sits there at all, nothing to depict).

export interface CardDimensions {
  width: number;
  height: number;
  fontSize: number;
}

// `deityCardState` is only ever set from a real, already-played TrickPlay's
// own stored state (see rules/types.ts's DeityCardState doc comment) - a
// Deity Card still sitting in a hand/redistribution-stack context hasn't
// been played yet and has no state, so it's omitted/null there and always
// renders its Dormant treatment (see ui/cardArt.ts's buildCard).
export type CardFace =
  | { kind: 'faceup'; cardId: CardId; deityCardState?: DeityCardState | null }
  | { kind: 'facedown' }
  | { kind: 'empty' };

export interface CardStyle {
  fill: number;
  border: number;
  borderWidth?: number;
  textColor?: string;
  alpha?: number;
  // Draws the illegal-card dimmer overlay (see drawIllegalDimmer below) on
  // top of a real card's finished art. Deliberately separate from `alpha`:
  // that fades the whole container (frame color and all, unevenly per
  // Deity), while this is a dedicated neutral-dark shape sized and
  // corner-chamfered to match the card underneath - see the "already-
  // approved" Hand fan spec in suits-mp-screen-reference.md: "illegal
  // cards get a neutral dim (no LOCKED text/stripes)".
  dimmed?: boolean;
}

export interface DrawnCard {
  container: Phaser.GameObjects.Container;
  hitArea: Phaser.GameObjects.Rectangle;
}

// Air Deck proportions (BRIEF.md's Stage 3a amendment): noticeably
// narrower than a standard poker card's ~0.71 width:height ratio -
// `dims.width`/`dims.height` themselves come from tune.json (see
// renderGameView.ts's CARD_DIMS_STANDARD/CARD_DIMS_MINI), this module
// just draws whatever ratio it's handed.
export function drawCard(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  rotationDeg: number,
  face: CardFace,
  style: CardStyle,
  dims: CardDimensions,
): DrawnCard {
  const card = scene.add.container(x, y);
  card.setRotation((rotationDeg * Math.PI) / 180);
  parent.add(card);
  const alpha = style.alpha ?? 1;

  if (face.kind === 'empty') {
    const g = scene.add.graphics();
    g.lineStyle(1.5, style.border, alpha * 0.8);
    drawDashedRect(g, -dims.width / 2, -dims.height / 2, dims.width, dims.height, 4, 3);
    card.add(g);
    const hit = scene.add.rectangle(0, 0, dims.width, dims.height, 0x000000, 0.001);
    card.add(hit);
    return { container: card, hitArea: hit };
  }

  if (face.kind === 'facedown') {
    // Complete standalone image (no Deity frame/symbol/rank/nameplate/face
    // composited onto it, per the handoff) - drawn full-canvas the same
    // way buildCard() draws a faceup card's own full-canvas frame layer.
    // `alpha` (e.g. stackNeededStyle's 0.55 dim for a not-yet-filled
    // redistribution slot) applies to the whole card the same way it
    // already did for the old placeholder rectangle.
    const back = scene.add.image(0, 0, 'card_back').setDisplaySize(dims.width, dims.height);
    card.add(back);
    card.setAlpha(alpha);
    const hit = scene.add.rectangle(0, 0, dims.width, dims.height, 0x000000, 0.001);
    card.add(hit);
    return { container: card, hitArea: hit };
  }

  // Real card art (frame + god symbol/face + live rank Text) - see
  // ui/cardArt.ts. The finished art already reads clearly on its own; a
  // rim outline drawn on top of it (the previous approach here) just adds
  // wireframe clutter across real illustration. Selected state has its
  // own signal independent of any outline (the hand fan pops the selected
  // card up and draws it last - see renderGameView.ts's renderCardFan),
  // so removing the rim doesn't lose that. Illegal state gets a dedicated
  // dimmer overlay instead (see drawIllegalDimmer below) rather than an
  // outline or a whole-container alpha fade.
  const cardDef = cardById(face.cardId);
  const built = buildCard(scene, cardDef.god, cardDef.rank, dims, face.deityCardState ?? null);
  card.add(built.container);
  card.setAlpha(alpha);
  if (style.dimmed) {
    card.add(drawIllegalDimmer(scene, dims.width, dims.height));
  }

  return { container: card, hitArea: built.hitArea };
}

// The card frame art's own outer corners are cut with a straight 45deg
// chamfer (measured directly off card_frame_<deity>.png's alpha channel:
// ~37-39px on the shared 1024-wide reference canvas, consistent across
// all four Deities - not a circular curve/fillet at any radius, so a
// Graphics.fillRoundedRect would visibly mismatch the card's actual
// corner shape). Expressed here as a fraction of card width so it scales
// correctly at any CardDimensions.
const CARD_CORNER_CHAMFER_FRACTION = 38 / 1024;

// Illegal-card dimmer: a dedicated semi-transparent neutral-dark shape
// drawn on top of a card's finished art (never a whole-container alpha
// fade, which fades unevenly depending on each card's own frame color).
// Sized to exactly dims.width x dims.height - the same box every other
// card layer (backdrop/frame) is drawn into - with its corners chamfered
// to match the frame's real corner treatment instead of a hard-edged
// rectangle that would visibly overhang the card's own cut corners.
// Smooth and neutral only: dark fill, no color tint, no stripes or text -
// see the "already-approved" hand fan spec in
// suits-mp-screen-reference.md ("illegal cards get a neutral dim (no
// LOCKED text/stripes)").
function drawIllegalDimmer(scene: Phaser.Scene, width: number, height: number): Phaser.GameObjects.Graphics {
  const c = Math.min(width, height) * CARD_CORNER_CHAMFER_FRACTION;
  const halfW = width / 2;
  const halfH = height / 2;
  const points = [
    { x: -halfW + c, y: -halfH },
    { x: halfW - c, y: -halfH },
    { x: halfW, y: -halfH + c },
    { x: halfW, y: halfH - c },
    { x: halfW - c, y: halfH },
    { x: -halfW + c, y: halfH },
    { x: -halfW, y: halfH - c },
    { x: -halfW, y: -halfH + c },
  ];
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.55);
  g.fillPoints(points, true);
  return g;
}

function drawDashedRect(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, dash: number, gap: number): void {
  const segments: [number, number, number, number][] = [
    [x, y, x + w, y],
    [x + w, y, x + w, y + h],
    [x + w, y + h, x, y + h],
    [x, y + h, x, y],
  ];
  for (const [x1, y1, x2, y2] of segments) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const dx = (x2 - x1) / len;
    const dy = (y2 - y1) / len;
    let drawn = 0;
    while (drawn < len) {
      const segLen = Math.min(dash, len - drawn);
      g.beginPath();
      g.moveTo(x1 + dx * drawn, y1 + dy * drawn);
      g.lineTo(x1 + dx * (drawn + segLen), y1 + dy * (drawn + segLen));
      g.strokePath();
      drawn += dash + gap;
    }
  }
}

