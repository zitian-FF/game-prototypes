import Phaser from 'phaser';
import { GOD_ABBR, GOD_DISPLAY_NAME, GOD_TEAM, TEAMMATE_GOD, sortCardIds, sortCardIdsByRank } from '../rules/cards';
import type { CardId, God } from '../rules/types';
import { bindTapIntent } from '../input/intents';
import { PIXEL_RATIO } from '../render/pixelRatio';
import { ALL_NET_PLAYER_IDS } from '../net/netPlayerId';
import type { NetPlayerId } from '../net/netPlayerId';
import type { ClientAction, MaskedState, MaskedTrickPlay } from '../net/actions';
import { colorFor, computeHandLegality, nextSelectionAfterTap } from './handLegality';
import type { CardVisualState } from './handLegality';
import { buildSeatMap, computeSuitRing, seatFor, seatLabelFor } from './seating';
import type { SeatPosition } from './seating';
import { computeFanLayouts } from './cardFan';
import type { FanConfig } from './cardFan';
import { drawCard } from './cardComponent';
import type { CardDimensions, CardFace, CardStyle } from './cardComponent';
import { closeRules, openRules } from '../dom/domUiStore';
import tune from '../../tune.json';

// Stage 3a (+ amendment): the gameplay screen is laid out with Phaser
// primitives (rectangles, circles, text) instead of Stage 2's monospace
// text dump - see BRIEF.md's "Stage 3a: Core gameplay screen" section for
// the original spec, and its amendment section for the unified card
// component / Air Deck proportions / pop-out selection / redistribution
// card-back stacks this file now implements. Still placeholder-first per
// root CLAUDE.md: no sprites or art, coloured shapes and text only. The
// Rules overlay and full Redistribution log content are explicitly
// stubbed - real design for both comes from Claude Design as DOM overlays
// in a later stage (3c).

const FONT = 'monospace';
const WIDTH = 390;
const HEIGHT = 844;
const CENTER_X = WIDTH / 2;

// --- Card dimensions (shared component - see ui/cardComponent.ts) ------
// "Standard" is used everywhere a full-size card appears (hand fan, every
// play area); "mini" is used for the two compact contexts (redistribution
// progress stacks, previous-trick log) - see BRIEF.md's amendment, item 1.

const CARD_DIMS_STANDARD: CardDimensions = {
  width: tune.cardStandardWidth,
  height: tune.cardStandardHeight,
  fontSize: tune.cardStandardFontSize,
};
const CARD_DIMS_MINI: CardDimensions = {
  width: tune.cardMiniWidth,
  height: tune.cardMiniHeight,
  fontSize: tune.cardMiniFontSize,
};
const CARD_GAP = 4;

// --- Layout constants -------------------------------------------------

const TOP_BAR_Y = 20;
const TOP_TAG_Y = 82;
const TOP_BOX_Y = 140;
const CLUSTER_CENTER_Y = 280;
const HUD_HUB_RADIUS = 28;
const HUD_NODE_RADIUS = 12;
const HUD_RING_RADIUS = tune.suitCycleHudRadius;
const BOTTOM_BOX_Y = 410;
const BOTTOM_TAG_Y = 466;
const SIDE_BOX_Y = CLUSTER_CENTER_Y;
const LEFT_BOX_X = 58;
const RIGHT_BOX_X = WIDTH - 58;
const SIDE_TAG_Y = SIDE_BOX_Y + CARD_DIMS_STANDARD.height / 2 + 16;
const DELEGATE_TAG_HIT_W = 74;

const YOUR_ROW_Y = 500;
const SORT_BUTTON_Y = 545;
const FAN_BASELINE_Y = 615;
const ACTION_BUTTON_Y = HEIGHT - 130;
const REDIST_LOG_BUTTON_Y = HEIGHT - 30;

const FAN_CONFIG: FanConfig = {
  perCardStepDeg: tune.handFanPerCardStepDeg,
  maxSpreadDeg: tune.handFanMaxSpreadDeg,
  radius: tune.handFanRadius,
  cardWidth: CARD_DIMS_STANDARD.width,
  cardHeight: CARD_DIMS_STANDARD.height,
};

// --- Colors -------------------------------------------------------------

const GOD_COLOR: Record<God, number> = {
  YogSothoth: 0x8866ff,
  Cthulhu: 0x33bbaa,
  ShubNiggurath: 0x55cc55,
  Nyarlathotep: 0xff7744,
};
const COLOR_PANEL = 0x1c1c26;
const COLOR_PANEL_BORDER = 0x3a3a48;
const COLOR_TURN_DOT = 0x88ff88;
const COLOR_STARTER_DOT = 0xffd27a;
const COLOR_TEAM_CHAOS = 0xff6666;
const COLOR_TEAM_COSMOS = 0x66aaff;
const COLOR_BUTTON_ENABLED = 0x2f6b3a;
const COLOR_BUTTON_DISABLED = 0x2a2a30;
const COLOR_BUTTON_TEXT_ENABLED = '#bdf5c9';
const COLOR_BUTTON_TEXT_DISABLED = '#777780';
const COLOR_STUB_BUTTON = 0x26262e;

function toColorString(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

// Never reveals another player's facedown (offsuit) card, regardless of
// what `play.cards` technically contains. host/mask.ts currently sends
// the real card id for offsuit plays to every peer (a pre-existing
// masking gap that predates Stage 3a - fixing it belongs in mask.ts,
// out of scope here). This is a presentation-only safeguard so play areas
// and the log don't visually leak it even though the payload already has
// it. Your own plays are always shown plainly - no privacy concern in
// seeing your own card. Returns one CardFace per card in the play (1 for
// a normal/offsuit single, 2 for a double) - the shared card component
// (ui/cardComponent.ts) draws whichever face this resolves to, so both
// the live play-area boxes and the previous-trick log render identically
// masked.
function maskedPlayFaces(play: MaskedTrickPlay, yourSlot: NetPlayerId): CardFace[] {
  if (play.kind === 'offsuit' && play.player !== yourSlot) return [{ kind: 'facedown' }];
  return play.cards.map((id): CardFace => ({ kind: 'faceup', cardId: id }));
}

// --- Card style presets ---------------------------------------------------
// Each context supplies its own CardStyle to the shared drawCard() - the
// component itself has no opinion on what a state means, only how it
// looks once decided (see cardComponent.ts's doc comment).

function handCardStyle(cardState: CardVisualState | null): CardStyle {
  if (!cardState) return { fill: COLOR_PANEL, border: 0x55555f, textColor: '#cccccc' };
  const textColor = colorFor(cardState);
  const fill = cardState === 'selected' ? 0x3a3320 : cardState === 'partner' ? 0x1c3a3a : cardState === 'illegal' ? 0x18181c : COLOR_PANEL;
  const border = cardState === 'illegal' ? 0x2a2a30 : 0x55555f;
  return { fill, border, textColor };
}

function playAreaStyle(face: CardFace): CardStyle {
  if (face.kind === 'facedown') return { fill: 0x22223a, border: 0x44446a };
  return { fill: COLOR_PANEL, border: COLOR_PANEL_BORDER, textColor: '#eeeeee' };
}

function emptySlotStyle(): CardStyle {
  return { fill: 0x121218, border: 0x444450 };
}

function stackFilledStyle(): CardStyle {
  return { fill: 0x2a4a33, border: 0x5ac97a };
}

function stackNeededStyle(): CardStyle {
  return { fill: 0x1c1c26, border: 0x3a3a48, alpha: 0.55 };
}

function logCardStyle(face: CardFace): CardStyle {
  if (face.kind === 'facedown') return { fill: 0x22223a, border: 0x44446a };
  return { fill: COLOR_PANEL, border: COLOR_PANEL_BORDER, textColor: '#dddddd' };
}

// --- View state -----------------------------------------------------------

// Local-only selection state for whatever action is in progress. Must
// survive re-renders triggered by the player's own taps (see `rerender`
// below) - it only resets when a genuinely new masked state arrives from
// the host, which is a fresh decision point. `selectedCards` is reused for
// both the play-phase single/pair selection (via handLegality.ts, exactly
// as before) and the redistribute-phase "staged candidate card" (holds 0
// or 1 id) - both are "what's currently tapped in the fan, not yet
// committed" in the same sense.
interface ViewState {
  selectedCards: CardId[];
  redistributeAssignment: Partial<Record<NetPlayerId, CardId[]>>;
  delegateChoice: NetPlayerId | null;
}

function freshViewState(): ViewState {
  return { selectedCards: [], redistributeAssignment: {}, delegateChoice: null };
}

export type OverlayKind = 'none' | 'log' | 'rules' | 'redistLog';
export type SortMode = 'suit' | 'rank';

// UI preferences that must survive every masked-state push from *any*
// player's action, not just the local player's own taps - unlike
// ViewState above, these aren't tied to a particular decision point, so
// HostGameScene/PlayerGameScene each own one instance for their scene's
// whole lifetime and pass it into every renderGameView call.
export interface PersistentUIState {
  overlay: OverlayKind;
  sortMode: SortMode;
}

export function createPersistentUIState(): PersistentUIState {
  return { overlay: 'none', sortMode: 'suit' };
}

type RectFn = (x: number, y: number, w: number, h: number, fill: number, alpha?: number) => Phaser.GameObjects.Rectangle;
type TextFn = (x: number, y: number, str: string, color?: string, size?: number, align?: string) => Phaser.GameObjects.Text;
type ButtonFn = (
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  onTap: (() => void) | null,
  options?: { fill?: number; textColor?: string; fontSize?: number },
) => void;

export function renderGameView(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  state: MaskedState,
  sendAction: (action: ClientAction) => void,
  ui: PersistentUIState,
): void {
  renderWithView(scene, container, state, sendAction, freshViewState(), ui);
}

function renderWithView(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  state: MaskedState,
  sendAction: (action: ClientAction) => void,
  view: ViewState,
  ui: PersistentUIState,
): void {
  container.removeAll(true);
  const rerender = (): void => renderWithView(scene, container, state, sendAction, view, ui);

  const rect: RectFn = (x, y, w, h, fill, alpha = 1) => {
    const r = scene.add.rectangle(x, y, w, h, fill, alpha);
    container.add(r);
    return r;
  };

  const text: TextFn = (x, y, str, color = '#eeeeee', size = 12, align = 'center') => {
    const t = scene.add
      .text(x, y, str, { fontFamily: FONT, fontSize: `${size}px`, color, align, resolution: PIXEL_RATIO })
      .setOrigin(0.5);
    container.add(t);
    return t;
  };

  const circle = (x: number, y: number, r: number, fill: number, alpha = 1): Phaser.GameObjects.Arc => {
    const c = scene.add.circle(x, y, r, fill, alpha);
    container.add(c);
    return c;
  };

  const button: ButtonFn = (x, y, w, h, str, onTap, options = {}) => {
    const fill = options.fill ?? (onTap ? COLOR_BUTTON_ENABLED : COLOR_BUTTON_DISABLED);
    const r = rect(x, y, w, h, fill);
    const t = text(x, y, str, options.textColor ?? (onTap ? COLOR_BUTTON_TEXT_ENABLED : COLOR_BUTTON_TEXT_DISABLED), options.fontSize ?? 13);
    if (onTap) {
      r.setInteractive({ useHandCursor: true });
      bindTapIntent(r, onTap);
    }
    return void t;
  };

  // Rules is real content now, rendered by the DOM overlay layer above the
  // canvas (see dom/RulesModal.tsx) rather than drawn with Phaser
  // primitives - see root CLAUDE.md's "UI implementation split". Canvas
  // draws nothing further this frame; closing the modal hands control back
  // via this same closure.
  if (ui.overlay === 'rules') {
    openRules(() => {
      ui.overlay = 'none';
      rerender();
    });
    return;
  }
  closeRules();

  if (ui.overlay !== 'none') {
    renderOverlay(scene, container, state, ui.overlay, ui, rerender, rect, text, button);
    return;
  }

  if (state.winner) {
    renderGameOver(state, rect, text, button, ui, rerender);
    return;
  }

  renderTopBar(state, ui, rerender, rect, text, button);
  const suitRing = renderPlayerCluster(scene, container, state, view, rerender, rect, text);
  renderYourRow(state, suitRing, rect, text, circle);
  const legality = state.turnPhase === 'play' ? computeHandLegality(state, view.selectedCards) : null;
  renderSortButton(ui, rerender, button);
  renderCardFan(scene, container, state, view, ui, legality, rerender);
  renderActionButton(state, view, legality, sendAction, rerender, button);
  renderRedistLogStub(ui, rerender, button);
}

// --- Top bar ----------------------------------------------------------

function renderTopBar(state: MaskedState, ui: PersistentUIState, rerender: () => void, rect: RectFn, text: TextFn, button: ButtonFn): void {
  const phaseLabel: Record<MaskedState['turnPhase'], string> = {
    play: 'Play Card',
    selectDelegate: 'Select Delegate',
    redistribute: 'Redistribute',
    gameOver: 'Game Over',
  };
  text(CENTER_X, TOP_BAR_Y, `Trick: ${state.trickNumber}`, '#eeeeee', 14);
  text(CENTER_X, TOP_BAR_Y + 20, `Phase: ${phaseLabel[state.turnPhase]}`, '#aaaaaa', 11);

  button(46, TOP_BAR_Y, 68, 26, 'Log', () => {
    ui.overlay = 'log';
    rerender();
  }, { fill: COLOR_STUB_BUTTON, textColor: '#cccccc', fontSize: 11 });

  button(WIDTH - 46, TOP_BAR_Y, 68, 26, 'Rules', () => {
    ui.overlay = 'rules';
    rerender();
  }, { fill: COLOR_STUB_BUTTON, textColor: '#cccccc', fontSize: 11 });
  void rect;
}

// --- Player cluster: Suit Cycle HUD + 4 play areas + name tags --------

function seatCenter(seat: SeatPosition): { x: number; y: number } {
  switch (seat) {
    case 'top':
      return { x: CENTER_X, y: TOP_BOX_Y };
    case 'right':
      return { x: RIGHT_BOX_X, y: SIDE_BOX_Y };
    case 'left':
      return { x: LEFT_BOX_X, y: SIDE_BOX_Y };
    case 'bottom':
      return { x: CENTER_X, y: BOTTOM_BOX_Y };
  }
}

// Top's tag sits *above* its play area (rather than below, like the other
// three seats) specifically so it doesn't crowd the Suit Cycle HUD's own
// top-node suit label, which sits just below the top box - see
// TOP_TAG_Y/TOP_BOX_Y's relative spacing above.
function nameTagY(seat: SeatPosition): number {
  switch (seat) {
    case 'top':
      return TOP_TAG_Y;
    case 'bottom':
      return BOTTOM_TAG_Y;
    case 'right':
    case 'left':
      return SIDE_TAG_Y;
  }
}

function renderPlayerCluster(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  state: MaskedState,
  view: ViewState,
  rerender: () => void,
  rect: RectFn,
  text: TextFn,
): ReturnType<typeof computeSuitRing> {
  const seatMap = buildSeatMap(state.yourSlot);
  // Item: local-only pre-commit HUD preview for the trick leader's own
  // screen (see ui/seating.ts's computeSuitRing doc comment) - only ever
  // reads this player's own in-progress selection, never sent over the
  // network, so it can't leak anything to other players.
  const previewCardId = view.selectedCards.length === 1 ? view.selectedCards[0] : null;
  const suitRing = computeSuitRing(state, previewCardId);

  // Suit Cycle HUD: a hub circle plus 4 ring nodes, one per seat.
  const hub = scene.add.circle(CENTER_X, CLUSTER_CENTER_Y, HUD_HUB_RADIUS, 0x14141a, 1).setStrokeStyle(1, COLOR_PANEL_BORDER);
  container.add(hub);
  text(CENTER_X, CLUSTER_CENTER_Y, 'Suits', '#666677', 10);

  for (const node of suitRing) {
    const { x, y } = ringNodeCenter(node.seat);
    const fill = node.suit ? GOD_COLOR[node.suit] : 0x2a2a32;
    const alpha = node.isLeader ? 1 : node.suit ? 0.55 : 0.3;
    const circle = scene.add.circle(x, y, HUD_NODE_RADIUS, fill, alpha);
    if (node.isLeader) circle.setStrokeStyle(node.isLocalPreview ? 1 : 2, 0xffffff, node.isLocalPreview ? 0.6 : 1);
    container.add(circle);
    if (node.suit) text(x, y - HUD_NODE_RADIUS - 9, GOD_ABBR[node.suit], node.isLeader ? '#ffffff' : '#999999', 9);
  }

  const isDelegating = state.delegateChoices !== null;
  const redistCtx = state.redistribution;

  for (const seat of ['top', 'right', 'left', 'bottom'] as const) {
    const pid = seatMap[seat];
    const isYou = seat === 'bottom';
    const { x, y } = seatCenter(seat);

    renderPlayArea(scene, container, state, view, pid, x, y, redistCtx, rerender, text);

    const tagY = nameTagY(seat);
    const isTurn = pid === state.currentTurn;
    const isStarter = suitRing.find((n) => n.player === pid)?.isLeader ?? false;
    const seatLabel = seatLabelFor(seat);
    const label = isYou ? `${seatLabel} (You)` : seatLabel;

    const delegateTappable = isDelegating && !isYou;
    const staged = view.delegateChoice === pid;
    const tagColor = staged ? '#ffd27a' : delegateTappable ? '#ffffff' : '#cccccc';
    const tagText = text(x, tagY, label, tagColor, 11);
    if (delegateTappable) {
      const hit = rect(x, tagY, DELEGATE_TAG_HIT_W, 20, staged ? 0x4a3a1a : 0x22222a, staged ? 0.9 : 0.001);
      hit.setInteractive({ useHandCursor: true });
      bindTapIntent(hit, () => {
        view.delegateChoice = pid;
        rerender();
      });
      container.bringToTop(tagText);
    }

    if (isTurn) {
      const dot = scene.add.circle(x - DELEGATE_TAG_HIT_W / 2 - 10, tagY, 4, COLOR_TURN_DOT);
      container.add(dot);
    }
    if (isStarter) {
      const dot = scene.add.circle(x + DELEGATE_TAG_HIT_W / 2 + 10, tagY, 4, COLOR_STARTER_DOT);
      container.add(dot);
    }
  }

  return suitRing;
}

function ringNodeCenter(seat: SeatPosition): { x: number; y: number } {
  switch (seat) {
    case 'top':
      return { x: CENTER_X, y: CLUSTER_CENTER_Y - HUD_RING_RADIUS };
    case 'right':
      return { x: CENTER_X + HUD_RING_RADIUS, y: CLUSTER_CENTER_Y };
    case 'bottom':
      return { x: CENTER_X, y: CLUSTER_CENTER_Y + HUD_RING_RADIUS };
    case 'left':
      return { x: CENTER_X - HUD_RING_RADIUS, y: CLUSTER_CENTER_Y };
  }
}

// One opponent/own play-area slot, entirely built from the shared card
// component (ui/cardComponent.ts) - amendment item 1's whole point.
// Shows this trick's play (masked for offsuit plays that aren't yours -
// see maskedPlayFaces), an empty-slot placeholder if nobody's played yet,
// or, when this player is owed a redistribution gift and *you're* the one
// performing it, a facedown card-back progress stack instead (item 4).
function renderPlayArea(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  state: MaskedState,
  view: ViewState,
  pid: NetPlayerId,
  x: number,
  y: number,
  redistCtx: MaskedState['redistribution'],
  rerender: () => void,
  text: TextFn,
): void {
  const contribution = redistCtx?.contributions.find((c) => c.player === pid) ?? null;

  if (redistCtx && contribution) {
    renderRedistributionStack(scene, container, view, pid, x, y, contribution.count, rerender, text);
    return;
  }

  const play = state.currentTrick.find((p) => p.player === pid) ?? null;
  if (!play) {
    drawCard(scene, container, x, y, 0, { kind: 'empty' }, emptySlotStyle(), CARD_DIMS_STANDARD);
    return;
  }

  const faces = maskedPlayFaces(play, state.yourSlot);
  drawCardRow(scene, container, x, y, faces, CARD_DIMS_STANDARD, playAreaStyle);
}

// Draws 1-2 cards (a play is 1 card for normal/offsuit, 2 for a double)
// centered as a row at (x, y) - shared by play areas and the
// previous-trick log, since both need to show a multi-card play as a
// small side-by-side group rather than a single card.
function drawCardRow(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  x: number,
  y: number,
  faces: CardFace[],
  dims: CardDimensions,
  styleFor: (face: CardFace) => CardStyle,
): void {
  const totalW = faces.length * dims.width + (faces.length - 1) * CARD_GAP;
  let cx = x - totalW / 2 + dims.width / 2;
  for (const face of faces) {
    drawCard(scene, container, cx, y, 0, face, styleFor(face), dims);
    cx += dims.width + CARD_GAP;
  }
}

// Redistribution progress (amendment item 4): one facedown mini card-back
// per card this player is owed, dimmed until assigned, filled/accented
// once it is - a small "have/need" label rides alongside for clarity, but
// the card-back stack is the primary visual, per the brief. Tapping the
// whole slot (while it's still unfulfilled and a candidate card is
// staged in the fan) assigns the staged card here, exactly as before.
function renderRedistributionStack(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  view: ViewState,
  pid: NetPlayerId,
  x: number,
  y: number,
  need: number,
  rerender: () => void,
  text: TextFn,
): void {
  const have = (view.redistributeAssignment[pid] ?? []).length;
  const fulfilled = have >= need;

  const totalW = need * CARD_DIMS_MINI.width + (need - 1) * CARD_GAP;
  let cx = x - totalW / 2 + CARD_DIMS_MINI.width / 2;
  for (let i = 0; i < need; i++) {
    const filled = i < have;
    drawCard(scene, container, cx, y, 0, { kind: 'facedown' }, filled ? stackFilledStyle() : stackNeededStyle(), CARD_DIMS_MINI);
    cx += CARD_DIMS_MINI.width + CARD_GAP;
  }
  text(x, y + CARD_DIMS_MINI.height / 2 + 12, `${have}/${need}`, fulfilled ? '#88ff99' : '#dddddd', 11);

  if (!fulfilled && view.selectedCards.length === 1) {
    const hit = scene.add.rectangle(x, y, Math.max(totalW, CARD_DIMS_MINI.width) + 12, CARD_DIMS_MINI.height + 20, 0x000000, 0.001);
    container.add(hit);
    hit.setInteractive({ useHandCursor: true });
    bindTapIntent(hit, () => {
      const cardId = view.selectedCards[0];
      const list = view.redistributeAssignment[pid] ?? [];
      view.redistributeAssignment[pid] = [...list, cardId];
      view.selectedCards = [];
      rerender();
    });
  }
}

// --- Your row: starter indicator, name tag, team tag -------------------

function renderYourRow(
  state: MaskedState,
  suitRing: ReturnType<typeof computeSuitRing>,
  rect: RectFn,
  text: TextFn,
  circle: (x: number, y: number, r: number, fill: number, alpha?: number) => Phaser.GameObjects.Arc,
): void {
  const youAreStarter = suitRing.find((n) => n.player === state.yourSlot)?.isLeader ?? false;

  text(62, YOUR_ROW_Y, youAreStarter ? 'You lead' : 'Not leading', youAreStarter ? '#ffd27a' : '#666670', 10);

  text(180, YOUR_ROW_Y, `You: ${seatLabelFor('bottom')}`, '#eeeeee', 11);
  if (state.currentTurn === state.yourSlot) {
    circle(180 - 32, YOUR_ROW_Y, 4, COLOR_TURN_DOT);
  }

  // Team is publicly derivable the moment you know your own god - both
  // team gods are shown, with your actual identity highlighted, but this
  // never reveals which of the other 3 players holds the teammate
  // identity, or anything about the opposing team.
  const team = GOD_TEAM[state.yourGod];
  const teammateGod = TEAMMATE_GOD[state.yourGod];
  const teamColor = team === 'Chaos' ? COLOR_TEAM_CHAOS : COLOR_TEAM_COSMOS;
  text(320, YOUR_ROW_Y - 10, `Team ${team}`, toColorString(teamColor), 10);
  const chipY = YOUR_ROW_Y + 7;
  const gods = [state.yourGod, teammateGod];
  const chipW = 46;
  gods.forEach((g, i) => {
    const cx = 320 - chipW / 2 - 4 + i * (chipW + 4);
    const isYours = g === state.yourGod;
    rect(cx, chipY, chipW, 16, isYours ? GOD_COLOR[g] : 0x24242c, isYours ? 1 : 0.6);
    text(cx, chipY, GOD_ABBR[g], isYours ? '#111111' : '#888890', 9);
  });
}

// --- Sort button --------------------------------------------------------
// Anchored to the card fan's own top edge (amendment item 6) - previously
// sat in its own row under "Your row"; moved here so it visually reads as
// part of the hand/fan area it controls, not the trick/play-area section
// above it.

function renderSortButton(ui: PersistentUIState, rerender: () => void, button: ButtonFn): void {
  const label = ui.sortMode === 'suit' ? 'Sort: Suit' : 'Sort: Rank';
  button(WIDTH - 60, SORT_BUTTON_Y, 90, 22, label, () => {
    ui.sortMode = ui.sortMode === 'suit' ? 'rank' : 'suit';
    rerender();
  }, { fill: COLOR_STUB_BUTTON, textColor: '#cccccc', fontSize: 10 });
}

// --- Card fan (hand display) --------------------------------------------

// Redistribute-phase card state is a separate, much simpler vocabulary
// than the play phase's computeHandLegality (no suits/doubles/forced
// opener concepts apply to redistributing) - reuses the same
// legal/illegal/selected color language from handLegality.ts for visual
// consistency, per BRIEF.md's "Reuse the existing... state logic" note.
function redistributeCardState(id: CardId, assignedIds: ReadonlySet<CardId>, stagedId: CardId | null): CardVisualState {
  if (assignedIds.has(id)) return 'illegal';
  if (id === stagedId) return 'selected';
  return 'legal';
}

interface FanEntry {
  id: CardId;
  x: number;
  y: number;
  rotationDeg: number;
  cardState: CardVisualState | null;
}

function renderCardFan(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  state: MaskedState,
  view: ViewState,
  ui: PersistentUIState,
  legality: ReturnType<typeof computeHandLegality> | null,
  rerender: () => void,
): void {
  const sorter = ui.sortMode === 'suit' ? sortCardIds : sortCardIdsByRank;
  const hand = sorter(state.yourHand);

  const isYourTurn = state.currentTurn === state.yourSlot;
  const inPlayPhase = isYourTurn && state.turnPhase === 'play';
  const inRedistributePhase = state.redistribution !== null;
  const assignedIds = new Set(Object.values(view.redistributeAssignment).flat());
  const stagedId = view.selectedCards.length === 1 ? view.selectedCards[0] : null;

  const layouts = computeFanLayouts(hand.length, CENTER_X, FAN_BASELINE_Y + FAN_CONFIG.radius, FAN_CONFIG);

  const entries: FanEntry[] = hand.map((id, i) => {
    let cardState: CardVisualState | null = null;
    if (inPlayPhase && legality) cardState = legality.states.get(id) ?? null;
    else if (inRedistributePhase) cardState = redistributeCardState(id, assignedIds, stagedId);
    return { id, x: layouts[i].x, y: layouts[i].y, rotationDeg: layouts[i].rotationDeg, cardState };
  });

  // Item 3: selected card(s) pop out of the fan - translated up and drawn
  // last (so they're on top, unobscured by neighbors). A two-pass split
  // rather than a z-index call handles both single and Twin Awakening
  // pair selections uniformly, since both cards of a pair carry the
  // 'selected' state already.
  const nonSelected = entries.filter((e) => e.cardState !== 'selected');
  const selected = entries.filter((e) => e.cardState === 'selected');

  const drawEntry = (entry: FanEntry, poppedOut: boolean): void => {
    const y = poppedOut ? entry.y - tune.handFanPopOutDistance : entry.y;
    const dims: CardDimensions = poppedOut
      ? {
          width: CARD_DIMS_STANDARD.width * tune.handFanPopOutScale,
          height: CARD_DIMS_STANDARD.height * tune.handFanPopOutScale,
          fontSize: CARD_DIMS_STANDARD.fontSize,
        }
      : CARD_DIMS_STANDARD;
    const style = handCardStyle(entry.cardState);
    const { hitArea } = drawCard(scene, container, entry.x, y, entry.rotationDeg, { kind: 'faceup', cardId: entry.id }, style, dims);

    const canTapPlay = inPlayPhase && legality && entry.cardState !== 'illegal' && entry.cardState !== null;
    const canTapRedistribute = inRedistributePhase && entry.cardState !== 'illegal';
    if (canTapPlay) {
      hitArea.setInteractive({ useHandCursor: true });
      bindTapIntent(hitArea, () => {
        view.selectedCards = nextSelectionAfterTap(view.selectedCards, entry.id, entry.cardState as CardVisualState, legality!);
        rerender();
      });
    } else if (canTapRedistribute) {
      hitArea.setInteractive({ useHandCursor: true });
      bindTapIntent(hitArea, () => {
        view.selectedCards = stagedId === entry.id ? [] : [entry.id];
        rerender();
      });
    }
  };

  for (const entry of nonSelected) drawEntry(entry, false);
  for (const entry of selected) drawEntry(entry, true);
}

function seatLabelForNet(state: MaskedState, id: NetPlayerId) {
  return seatLabelFor(seatFor(id, state.yourSlot));
}

// --- Action button --------------------------------------------------------

function renderActionButton(
  state: MaskedState,
  view: ViewState,
  legality: ReturnType<typeof computeHandLegality> | null,
  sendAction: (action: ClientAction) => void,
  rerender: () => void,
  button: ButtonFn,
): void {
  const x = CENTER_X;
  const y = ACTION_BUTTON_Y;
  const w = WIDTH - 32;
  const h = 46;
  const isYourTurn = state.currentTurn === state.yourSlot;

  if (!isYourTurn || state.turnPhase === 'gameOver') {
    const label = state.currentTurn ? `Waiting for ${seatLabelForNet(state, state.currentTurn)}...` : 'Waiting...';
    button(x, y, w, h, label, null);
    return;
  }

  if (state.turnPhase === 'play') {
    if (legality?.playType) {
      const type = legality.playType;
      const cards = [...view.selectedCards];
      const label = type === 'single' ? 'Commit: Play Card' : type === 'double' ? 'Commit: Twin Awakening' : 'Commit: Facedown Card';
      button(x, y, w, h, label, () => sendAction({ action: 'playCard', playType: type, cards }));
    } else {
      button(x, y, w, h, 'Select a card to play', null);
    }
    return;
  }

  if (state.turnPhase === 'selectDelegate') {
    if (view.delegateChoice) {
      const target = view.delegateChoice;
      button(x, y, w, h, `Commit: Delegate to ${seatLabelForNet(state, target)}`, () =>
        sendAction({ action: 'selectDelegate', targetPlayer: target }),
      );
    } else {
      button(x, y, w, h, 'Select a delegate above', null);
    }
    return;
  }

  if (state.turnPhase === 'redistribute') {
    const ctx = state.redistribution;
    const allAssigned = !!ctx && ctx.contributions.every((c) => (view.redistributeAssignment[c.player] ?? []).length === c.count);
    if (allAssigned && ctx) {
      button(x, y, w, h, 'Commit: Redistribute', () =>
        sendAction({
          action: 'redistribute',
          assignments: ctx.contributions.map((c) => ({ toPlayer: c.player, cards: view.redistributeAssignment[c.player] ?? [] })),
        }),
      );
    } else {
      button(x, y, w, h, 'Assign all cards', null);
    }
  }
}

// --- Redistribution log stub entry point --------------------------------

function renderRedistLogStub(ui: PersistentUIState, rerender: () => void, button: ButtonFn): void {
  button(90, REDIST_LOG_BUTTON_Y, 148, 26, 'Redistribution log', () => {
    ui.overlay = 'redistLog';
    rerender();
  }, { fill: COLOR_STUB_BUTTON, textColor: '#aaaaaa', fontSize: 10 });
}

// --- Overlays: previous-trick log (real content, carried over from an
// earlier task) and the Redistribution-log stub (real design comes from
// Claude Design + DOM overlays in a later stage - see BRIEF.md). Rules is
// handled separately above - it's real content now, rendered by the DOM
// layer, not this canvas overlay. ---------------------------------------

function renderOverlay(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  state: MaskedState,
  kind: Exclude<OverlayKind, 'none' | 'rules'>,
  ui: PersistentUIState,
  rerender: () => void,
  rect: RectFn,
  text: TextFn,
  button: ButtonFn,
): void {
  rect(CENTER_X, HEIGHT / 2, WIDTH, HEIGHT, 0x0c0c10, 1);
  const title = kind === 'log' ? 'Previous Trick' : 'Redistribution Log';
  text(CENTER_X, 50, title, '#ffcc66', 16);

  if (kind === 'log') {
    renderPreviousTrickOverlay(scene, container, state, text);
  } else {
    text(CENTER_X, HEIGHT / 2 - 20, 'Redistribution log - coming in a later pass.', '#999999', 12);
  }

  button(CENTER_X, HEIGHT - 60, 120, 36, 'Close', () => {
    ui.overlay = 'none';
    rerender();
  });
}

// Item 2 (earlier task, amended for the shared card component - amendment
// item 5): the trick immediately before the one in progress, with
// per-card player attribution, in play order - never full game history.
// `state.previousTrick` already carries exactly that (see host/mask.ts),
// so this is pure presentation. Masked the same way as the live play-area
// boxes (see maskedPlayFaces) so a facedown card played last trick
// doesn't become visible in the log after the fact.
function renderPreviousTrickOverlay(scene: Phaser.Scene, container: Phaser.GameObjects.Container, state: MaskedState, text: TextFn): void {
  if (!state.previousTrick) {
    text(CENTER_X, 100, 'No previous trick yet.', '#777777', 12);
    return;
  }
  state.previousTrick.forEach((play, i) => {
    const rowY = 92 + i * (CARD_DIMS_MINI.height + 20);
    text(78, rowY, seatLabelForNet(state, play.player), '#dddddd', 12, 'left');
    const faces = maskedPlayFaces(play, state.yourSlot);
    drawCardRow(scene, container, 230, rowY, faces, CARD_DIMS_MINI, logCardStyle);
  });
}

// --- Game over --------------------------------------------------------

function renderGameOver(
  state: MaskedState,
  rect: RectFn,
  text: TextFn,
  button: ButtonFn,
  ui: PersistentUIState,
  rerender: () => void,
): void {
  const winner = state.winner;
  if (!winner) return;
  rect(CENTER_X, HEIGHT / 2, WIDTH, HEIGHT, 0x0c0c10, 1);
  text(CENTER_X, 110, '--- GAME OVER ---', '#ffd27a', 18);
  text(CENTER_X, 150, winner.detail, '#eeeeee', 13);
  text(CENTER_X, 178, `Winning team: ${winner.team ?? 'none (stalemate)'}`, '#ffd27a', 13);

  const revealed = ALL_NET_PLAYER_IDS.filter((slot) => state.revealedGods[slot]);
  if (revealed.length > 0) {
    text(CENTER_X, 220, 'Revealed identities:', '#aaaaaa', 12);
    revealed.forEach((slot, i) => {
      const god = state.revealedGods[slot]!;
      text(CENTER_X, 246 + i * 20, `${seatLabelForNet(state, slot)}: ${GOD_DISPLAY_NAME[god]}`, '#cccccc', 11);
    });
  }

  button(CENTER_X, HEIGHT - 60, 140, 36, 'Previous Trick Log', () => {
    ui.overlay = 'log';
    rerender();
  }, { fill: COLOR_STUB_BUTTON, textColor: '#cccccc', fontSize: 11 });
}
