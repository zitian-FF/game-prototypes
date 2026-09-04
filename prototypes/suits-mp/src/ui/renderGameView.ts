import Phaser from 'phaser';
import { GOD_DISPLAY_NAME, GOD_TEAM, TEAMMATE_GOD, sortCardIds, sortCardIdsByRank } from '../rules/cards';
import type { CardId, God } from '../rules/types';
import { bindTapIntent } from '../input/intents';
import { PIXEL_RATIO } from '../render/pixelRatio';
import { ALL_NET_PLAYER_IDS, fromNetPlayerId } from '../net/netPlayerId';
import type { NetPlayerId } from '../net/netPlayerId';
import type { ClientAction, MaskedState, MaskedTrickPlay } from '../net/actions';
import { colorFor, computeHandLegality, nextSelectionAfterTap } from './handLegality';
import type { CardVisualState } from './handLegality';
import { buildSeatMap, computeSuitRing, seatFor } from './seating';
import type { SeatPosition } from './seating';
import { computeFanLayouts } from './cardFan';
import type { FanConfig } from './cardFan';
import { drawCard } from './cardComponent';
import type { CardDimensions, CardFace, CardStyle } from './cardComponent';
import { closeMenu, closeRedistLog, closeRules, openMenu, openRedistLog, openRules } from '../dom/domUiStore';
import type { RedistLogEntry } from '../dom/domUiStore';
import { hideGameOverlay, showGameOverlay } from '../dom/overlay/gameOverlayStore';
import type { GodChipState, SeatDelegateState } from '../dom/overlay/gameOverlayStore';
import { GOD_TO_SUIT_INDEX, SUITS } from '../dom/overlay/overlayContent';
import tune from '../../tune.json';

// Stage 3a (+ amendment): the gameplay screen is laid out with Phaser
// primitives (rectangles, circles, text) instead of Stage 2's monospace
// text dump - see BRIEF.md's "Stage 3a: Core gameplay screen" section for
// the original spec, and its amendment section for the unified card
// component / Air Deck proportions / pop-out selection / redistribution
// card-back stacks this file now implements. Still placeholder-first per
// root CLAUDE.md: no sprites or art, coloured shapes and text only. The
// Rules overlay is real content now (dom/RulesModal.tsx), and so is the
// in-game HUD chrome - name tags, Suit Cycle HUD, turn indicator wheel,
// Trick Starter tag, Team/god HUD, Order/Action buttons - which now lives
// in dom/overlay/GameOverlay.tsx rather than being drawn here, driven by
// real MaskedState computed below and threaded through
// dom/overlay/gameOverlayStore.ts. Only the Redistribution log content is
// still stubbed.

const FONT = 'monospace';
const WIDTH = 390;
const HEIGHT = 844;
const CENTER_X = WIDTH / 2;

// background_tabletop_stone.png - texture key matches the manifest filename
// minus extension, per preloadCardArt's manifest-driven loose-image loader
// (ui/cardArt.ts) - loaded the same way as every card texture, no second
// loader.
const TABLETOP_KEY = 'background_tabletop_stone';

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
// Row anchors grown/spaced out from the card-frame compositing task's
// taller cards (tune.cardStandardHeight 82->114, matching the Card Frame
// design's true 300:816 proportions - see BUILD_STATUS.md). Keep these in
// sync with dom/overlay/GameOverlay.tsx's matching constants (TOP_TAG_TOP/
// SIDE_TAG_TOP/BOTTOM_TAG_TOP and the Team HUD's derived teamHudTop),
// which anchor DOM chrome around these same canvas-drawn play areas.
const TOP_BOX_Y = 150;
const CLUSTER_CENTER_Y = 305;
const BOTTOM_BOX_Y = 453;
const SIDE_BOX_Y = CLUSTER_CENTER_Y;
const LEFT_BOX_X = 58;
const RIGHT_BOX_X = WIDTH - 58;

const FAN_BASELINE_Y = 648;

const FAN_CONFIG: FanConfig = {
  perCardStepDeg: tune.handFanPerCardStepDeg,
  maxSpreadDeg: tune.handFanMaxSpreadDeg,
  radius: tune.handFanRadius,
  cardWidth: CARD_DIMS_STANDARD.width,
  cardHeight: CARD_DIMS_STANDARD.height,
};

// --- Colors -------------------------------------------------------------

const COLOR_PANEL = 0x1c1c26;
const COLOR_PANEL_BORDER = 0x3a3a48;
const COLOR_BUTTON_ENABLED = 0x2f6b3a;
const COLOR_BUTTON_DISABLED = 0x2a2a30;
const COLOR_BUTTON_TEXT_ENABLED = '#bdf5c9';
const COLOR_BUTTON_TEXT_DISABLED = '#777780';
const COLOR_STUB_BUTTON = 0x26262e;

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
  return play.cards.map((id): CardFace => ({ kind: 'faceup', cardId: id, deityCardState: play.deityCardState }));
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

export type OverlayKind = 'none' | 'log' | 'rules' | 'redistLog' | 'menu';
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

  // Tabletop treatment - drawn first so it always sits behind every other
  // canvas element this render pass adds (see board/UI requirements: real
  // R2-fetched art, loaded the same manifest-driven way as every card
  // texture - see preloadCardArt).
  if (scene.textures.exists(TABLETOP_KEY)) {
    const bg = scene.add.image(CENTER_X, HEIGHT / 2, TABLETOP_KEY).setDisplaySize(WIDTH, HEIGHT);
    container.add(bg);
  }

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
    hideGameOverlay();
    openRules(() => {
      ui.overlay = 'none';
      rerender();
    });
    return;
  }
  closeRules();

  // Redistribution log is real content now, rendered by the DOM overlay
  // layer above the canvas (see dom/RedistLogModal.tsx) rather than drawn
  // with Phaser primitives - same treatment as Rules above, per root
  // CLAUDE.md's "UI implementation split". Canvas draws nothing further
  // this frame; closing the modal hands control back via this same
  // closure.
  if (ui.overlay === 'redistLog') {
    hideGameOverlay();
    openRedistLog(computeRedistLogEntries(state), () => {
      ui.overlay = 'none';
      rerender();
    });
    return;
  }
  closeRedistLog();

  // Menu is real content now too (dom/MenuModal.tsx) - the board's new
  // top-left hub, hosting Rules and the previous-trick log (see
  // dom/overlay/GameOverlay.tsx's Menu button). Same treatment as Rules/
  // Redist Log above.
  if (ui.overlay === 'menu') {
    hideGameOverlay();
    openMenu(
      () => {
        closeMenu();
        ui.overlay = 'rules';
        rerender();
      },
      () => {
        closeMenu();
        ui.overlay = 'log';
        rerender();
      },
      () => {
        ui.overlay = 'none';
        rerender();
      },
    );
    return;
  }
  closeMenu();

  if (ui.overlay !== 'none') {
    hideGameOverlay();
    renderOverlay(scene, container, state, ui, rerender, rect, text, button);
    return;
  }

  if (state.winner) {
    hideGameOverlay();
    renderGameOver(state, rect, text, button, ui, rerender);
    return;
  }

  renderTopBar(state, text);
  renderPlayerCluster(scene, container, state, view, rerender, text);
  const legality = state.turnPhase === 'play' ? computeHandLegality(state, view.selectedCards) : null;
  renderCardFan(scene, container, state, view, ui, legality, rerender);
  const action = computeActionButtonState(state, view, legality, sendAction);
  const hud = computeGameOverlayHudState(state, view);
  showGameOverlay({
    sortLabel: ui.sortMode === 'suit' ? 'Sort: Suit' : 'Sort: Rank',
    onToggleSort: () => {
      ui.sortMode = ui.sortMode === 'suit' ? 'rank' : 'suit';
      rerender();
    },
    actionLabel: action.label,
    actionHint: action.hint,
    actionEnabled: action.enabled,
    onAction: () => {
      action.onClick();
    },
    onOpenRedistLog: () => {
      ui.overlay = 'redistLog';
      rerender();
    },
    onOpenMenu: () => {
      ui.overlay = 'menu';
      rerender();
    },
    seatDelegate: computeSeatDelegateState(state, view, rerender),
    seatLabels: hud.seatLabels,
    currentTurnSeat: hud.currentTurnSeat,
    starterSeat: hud.starterSeat,
    leadGodIndex: hud.leadGodIndex,
    teamName: hud.teamName,
    yourGodChip: hud.yourGodChip,
    teammateGodChip: hud.teammateGodChip,
    requiredSuitGod: hud.requiredSuitGod,
  });
}

// --- Top bar ----------------------------------------------------------

// Log/Rules access moved to the DOM Menu hub (dom/MenuModal.tsx, opened via
// the board's top-left Menu button) - this now only draws the Trick/Phase
// readout, per the approved preview's top bar.
function renderTopBar(state: MaskedState, text: TextFn): void {
  const phaseLabel: Record<MaskedState['turnPhase'], string> = {
    play: 'Play Card',
    selectDelegate: 'Select Delegate',
    redistribute: 'Redistribute',
    gameOver: 'Game Over',
  };
  text(CENTER_X, TOP_BAR_Y, `Trick: ${state.trickNumber}`, '#eeeeee', 14);
  text(CENTER_X, TOP_BAR_Y + 20, `Phase: ${phaseLabel[state.turnPhase]}`, '#aaaaaa', 11);
}

// --- Player cluster: 4 play areas ---------------------------------------
// Name tags, the Suit Cycle HUD, turn/starter indicators and the Team/god
// HUD are DOM chrome now (dom/overlay/GameOverlay.tsx) - this function
// only draws the actual card play areas, which stay canvas-owned.

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

function renderPlayerCluster(scene: Phaser.Scene, container: Phaser.GameObjects.Container, state: MaskedState, view: ViewState, rerender: () => void, text: TextFn): void {
  const seatMap = buildSeatMap(state.yourSlot);
  const redistCtx = state.redistribution;

  for (const seat of ['top', 'right', 'left', 'bottom'] as const) {
    const pid = seatMap[seat];
    const { x, y } = seatCenter(seat);
    renderPlayArea(scene, container, state, view, pid, x, y, redistCtx, rerender, text);
  }
}

// Real per-seat delegate-selection state, handed to the DOM name tags
// (dom/overlay/GameOverlay.tsx) via gameOverlayStore.ts. Tapping another
// seat's tag during the selectDelegate phase is the only way to choose
// who performs a redistribution; there is no other UI for it.
function computeSeatDelegateState(state: MaskedState, view: ViewState, rerender: () => void): Record<SeatPosition, SeatDelegateState> {
  const seatMap = buildSeatMap(state.yourSlot);
  const isDelegating = state.delegateChoices !== null;
  const result = {} as Record<SeatPosition, SeatDelegateState>;
  for (const seat of ['top', 'right', 'left', 'bottom'] as const) {
    const pid = seatMap[seat];
    const isYou = seat === 'bottom';
    const tappable = isDelegating && !isYou;
    result[seat] = {
      tappable,
      staged: view.delegateChoice === pid,
      onPick: () => {
        view.delegateChoice = pid;
        rerender();
      },
    };
  }
  return result;
}

export interface GameOverlayHudState {
  seatLabels: Record<SeatPosition, string>;
  currentTurnSeat: SeatPosition | null;
  starterSeat: SeatPosition | null;
  leadGodIndex: number | null;
  teamName: string;
  yourGodChip: GodChipState;
  teammateGodChip: GodChipState;
  requiredSuitGod: God | null;
}

// Real display-ready HUD data for dom/overlay/GameOverlay.tsx - computed
// from the exact same real state/logic the old Phaser-drawn Suit Cycle
// HUD/name-tag/turn-dot/starter-dot/Team-god-chip code used
// (ui/seating.ts's computeSuitRing, GOD_TEAM/TEAMMATE_GOD), just returned
// as data instead of drawn.
function computeGameOverlayHudState(state: MaskedState, view: ViewState): GameOverlayHudState {
  const seatMap = buildSeatMap(state.yourSlot);
  const seatLabels = {} as Record<SeatPosition, string>;
  for (const seat of ['top', 'right', 'left', 'bottom'] as const) {
    seatLabels[seat] = playerLabelFor(state, seatMap[seat]);
  }

  const previewCardId = view.selectedCards.length === 1 ? view.selectedCards[0] : null;
  const suitRing = computeSuitRing(state, previewCardId);
  const leaderNode = suitRing.find((n) => n.isLeader);
  const currentTurnSeat = state.currentTurn ? seatFor(state.currentTurn, state.yourSlot) : null;
  const teammateGod = TEAMMATE_GOD[state.yourGod];

  return {
    seatLabels,
    currentTurnSeat,
    starterSeat: leaderNode?.seat ?? null,
    leadGodIndex: leaderNode?.suit ? GOD_TO_SUIT_INDEX[leaderNode.suit] : null,
    teamName: `Team ${GOD_TEAM[state.yourGod]}`,
    yourGodChip: { code: SUITS[GOD_TO_SUIT_INDEX[state.yourGod]].code, label: 'Bound', god: state.yourGod },
    teammateGodChip: { code: SUITS[GOD_TO_SUIT_INDEX[teammateGod]].code, label: 'Kin', god: teammateGod },
    requiredSuitGod: state.requiredSuit,
  };
}

// A card-shaped recess carved into the stone tabletop, behind whatever
// actually occupies this play-area slot (a played card, an empty-slot
// placeholder, or a redistribution stack) - procedural Graphics, since no
// recess art asset was part of this handoff (only the tabletop surface
// itself, background_tabletop_stone.png). Visual reskin pass (see
// BUILD_STATUS.md): a soft outer shadow plus a top-darker/bottom-lighter
// gradient floor and a faint warm rim reads as a sunken hollow in the
// stone, rather than the flat black dashed-container look this used to
// have. Purely decorative - card slot position, hit target and seat
// relationship are unchanged; this is drawn first, behind everything.
function drawPlayAreaRecess(scene: Phaser.Scene, container: Phaser.GameObjects.Container, x: number, y: number): void {
  const w = CARD_DIMS_STANDARD.width + 16;
  const h = CARD_DIMS_STANDARD.height + 16;
  const rx = x - w / 2;
  const ry = y - h / 2;
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.16);
  g.fillRoundedRect(rx - 4, ry - 4, w + 8, h + 8, 12);
  g.fillGradientStyle(0x05060a, 0x05060a, 0x161a1e, 0x161a1e, 0.55, 0.55, 0.55, 0.55);
  g.fillRoundedRect(rx, ry, w, h, 8);
  g.lineStyle(1, 0x8a6a34, 0.22);
  g.strokeRoundedRect(rx, ry, w, h, 8);
  container.add(g);
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
  drawPlayAreaRecess(scene, container, x, y);

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

// Player-facing identity label: the real displayName if one was entered
// (falling back to a seat-numbered "Player N", absolute and the same for
// every viewer - see net/actions.ts's MaskedState.seatNames doc comment),
// with a "(You)" suffix for the local player's own slot. This is the
// absolute NetPlayerId->number mapping (p0->1..p3->4), deliberately NOT
// derived from seatFor/seatLabelFor's viewer-relative P1-P4 geometry
// labels - see BUILD_STATUS.md for why the two numbering systems must
// stay separate.
export function playerLabelFor(state: MaskedState, id: NetPlayerId): string {
  const name = state.seatNames[id]?.trim();
  const base = name || `Player ${fromNetPlayerId(id) + 1}`;
  return id === state.yourSlot ? `${base} (You)` : base;
}

// --- Action button --------------------------------------------------------

// Real Action-button state (label/hint/enabled/onClick), handed to the
// DOM button (dom/overlay/GameOverlay.tsx) via gameOverlayStore.ts rather
// than drawn here - same decision logic as before, just returned as data
// instead of calling Phaser's `button()`. `hint` is the design's small
// secondary line under the main label; it's only ever the one static
// string the design itself uses ("Commit the chosen card"), shown
// whenever there's a real committable action and blank otherwise.
interface ActionButtonState {
  label: string;
  hint: string;
  enabled: boolean;
  onClick: () => void;
}

const NO_OP = (): void => {};

function computeActionButtonState(
  state: MaskedState,
  view: ViewState,
  legality: ReturnType<typeof computeHandLegality> | null,
  sendAction: (action: ClientAction) => void,
): ActionButtonState {
  const isYourTurn = state.currentTurn === state.yourSlot;

  if (!isYourTurn || state.turnPhase === 'gameOver') {
    const label = state.currentTurn ? `Waiting for ${playerLabelFor(state, state.currentTurn)}...` : 'Waiting...';
    return { label, hint: '', enabled: false, onClick: NO_OP };
  }

  if (state.turnPhase === 'play') {
    if (legality?.playType) {
      const type = legality.playType;
      const cards = [...view.selectedCards];
      const label = type === 'single' ? 'Play Card' : type === 'double' ? 'Twin Awakening' : 'Facedown Card';
      return { label, hint: 'Commit the chosen card', enabled: true, onClick: () => sendAction({ action: 'playCard', playType: type, cards }) };
    }
    return { label: 'Select a card to play', hint: '', enabled: false, onClick: NO_OP };
  }

  if (state.turnPhase === 'selectDelegate') {
    if (view.delegateChoice) {
      const target = view.delegateChoice;
      return {
        label: `Delegate to ${playerLabelFor(state, target)}`,
        hint: 'Commit the chosen card',
        enabled: true,
        onClick: () => sendAction({ action: 'selectDelegate', targetPlayer: target }),
      };
    }
    return { label: 'Select a delegate above', hint: '', enabled: false, onClick: NO_OP };
  }

  const ctx = state.redistribution;
  const allAssigned = !!ctx && ctx.contributions.every((c) => (view.redistributeAssignment[c.player] ?? []).length === c.count);
  if (allAssigned && ctx) {
    return {
      label: 'Redistribute',
      hint: 'Commit the chosen card',
      enabled: true,
      onClick: () =>
        sendAction({
          action: 'redistribute',
          assignments: ctx.contributions.map((c) => ({ toPlayer: c.player, cards: view.redistributeAssignment[c.player] ?? [] })),
        }),
    };
  }
  return { label: 'Assign all cards', hint: '', enabled: false, onClick: NO_OP };
}

// --- Overlay: previous-trick log (real content, carried over from an
// earlier task). Rules and the Redistribution log are handled separately
// above - both are real content now, rendered by the DOM layer, not this
// canvas overlay. This is the only OverlayKind left that reaches here. ---

function renderOverlay(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  state: MaskedState,
  ui: PersistentUIState,
  rerender: () => void,
  rect: RectFn,
  text: TextFn,
  button: ButtonFn,
): void {
  rect(CENTER_X, HEIGHT / 2, WIDTH, HEIGHT, 0x0c0c10, 1);
  text(CENTER_X, 50, 'Previous Trick', '#ffcc66', 16);
  renderPreviousTrickOverlay(scene, container, state, text);

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
    text(78, rowY, playerLabelFor(state, play.player), '#dddddd', 12, 'left');
    const faces = maskedPlayFaces(play, state.yourSlot);
    drawCardRow(scene, container, 230, rowY, faces, CARD_DIMS_MINI, logCardStyle);
  });
}

// GDD "Redistribution Log": one entry per completed trick, from the
// viewing player's own perspective (see net/actions.ts's
// RedistributionLogEntry and host/mask.ts's buildMaskedState - both
// perspectives are already computed host-side, this is pure
// presentation). Real content now, rendered by the DOM overlay layer
// (dom/RedistLogModal.tsx) rather than drawn with Phaser primitives - see
// this function's call site above. Newest-first: unlike the previous-trick
// log (always exactly one trick) this can grow long over a 40-trick game,
// and the entry a player actually wants after a redistribution is the one
// that just happened, not the first one from the top of a long scroll.
function computeRedistLogEntries(state: MaskedState): RedistLogEntry[] {
  return [...state.redistributionLog].reverse().map((entry) => ({
    trickNumber: entry.trickNumber,
    perspective: entry.perspective,
    wonByDouble: entry.wonByDouble,
    fromPlayerLabel: playerLabelFor(state, entry.fromPlayer),
    groups: entry.groups.map((g) => ({ toPlayerLabel: playerLabelFor(state, g.toPlayer), cards: g.cards })),
  }));
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
      text(CENTER_X, 246 + i * 20, `${playerLabelFor(state, slot)}: ${GOD_DISPLAY_NAME[god]}`, '#cccccc', 11);
    });
  }

  button(CENTER_X, HEIGHT - 60, 140, 36, 'Previous Trick Log', () => {
    ui.overlay = 'log';
    rerender();
  }, { fill: COLOR_STUB_BUTTON, textColor: '#cccccc', fontSize: 11 });
}
