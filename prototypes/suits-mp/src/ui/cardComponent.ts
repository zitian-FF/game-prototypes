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
// composited art (see ui/cardArt.ts); facedown/empty stay placeholder
// primitives, since no card-back art was part of the Card Frame handoff.

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
    // No card-back art was part of this handoff (only the 40 face
    // designs) - facedown cards stay the placeholder rectangle + stripe
    // pattern.
    const box = scene.add.rectangle(0, 0, dims.width, dims.height, style.fill, alpha);
    box.setStrokeStyle(style.borderWidth ?? 1, style.border, alpha);
    card.add(box);
    drawFacedownPattern(scene, card, dims.width, dims.height, style.border, alpha);
    return { container: card, hitArea: box };
  }

  // Real card art (frame + god symbol/face + live rank Text) - see
  // ui/cardArt.ts. The caller's style still carries real meaning
  // (selected/legal/illegal/partner) that the ornate frame art can't
  // express on its own, so it's kept as a thin rim outline plus alpha
  // rather than discarded.
  const cardDef = cardById(face.cardId);
  const built = buildCard(scene, cardDef.god, cardDef.rank, dims, face.deityCardState ?? null);
  card.add(built.container);
  card.setAlpha(alpha);
  const rim = scene.add.rectangle(0, 0, dims.width, dims.height);
  rim.setStrokeStyle(style.borderWidth ?? 2, style.border, alpha);
  card.add(rim);

  return { container: card, hitArea: built.hitArea };
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

// Placeholder card-back pattern: a few diagonal accent stripes over the
// base fill, per BRIEF.md's "e.g. a diagonal stripe or pattern fill" -
// deliberately not pixel-clipped to the card's exact bounds (would need a
// rotation-aware Phaser geometry mask, real overkill for a primitives
// placeholder that's getting re-skinned in a later art pass anyway); any
// stripe overflow at the corners is a few px and reads fine at both card
// sizes this project uses.
function drawFacedownPattern(scene: Phaser.Scene, card: Phaser.GameObjects.Container, w: number, h: number, accent: number, alpha: number): void {
  const diag = Math.hypot(w, h);
  const stripeW = Math.max(2, w * 0.16);
  for (const offset of [-w * 0.25, 0, w * 0.25]) {
    const stripe = scene.add.rectangle(offset, 0, stripeW, diag, accent, alpha * 0.55);
    stripe.setRotation(Math.PI / 4);
    card.add(stripe);
  }
}
