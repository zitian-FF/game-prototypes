import Phaser from 'phaser';
import { GOD_ABBR, GOD_DISPLAY_NAME, GOD_TEAM, TEAMMATE_GOD, cardById, sortCardIds, sortCardIdsByRank } from '../rules/cards';
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
import tune from '../../tune.json';

// Stage 3a: the gameplay screen is now laid out with Phaser primitives
// (rectangles, circles, text) instead of Stage 2's monospace text dump -
// see BRIEF.md's "Stage 3a: Core gameplay screen" section for the full
// spec this implements. Still placeholder-first per root CLAUDE.md: no
// sprites or art, coloured shapes and text only. The Rules overlay and
// full Redistribution log content are explicitly stubbed this stage -
// real design for both comes from Claude Design as DOM overlays in a
// later stage (3c).

const FONT = 'monospace';
const WIDTH = 390;
const HEIGHT = 844;
const CENTER_X = WIDTH / 2;

// --- Layout constants -------------------------------------------------

const TOP_BAR_Y = 20;
const CLUSTER_CENTER_Y = 214;
const HUD_HUB_RADIUS = 28;
const HUD_NODE_RADIUS = 12;
const HUD_RING_RADIUS = tune.suitCycleHudRadius;

const PLAY_AREA_W = 104;
const PLAY_AREA_H = 46;
const SIDE_PLAY_AREA_W = 88;
const SIDE_PLAY_AREA_H = 52;

const TOP_TAG_Y = 58;
const TOP_BOX_Y = 94;
const BOTTOM_BOX_Y = 330;
const SIDE_BOX_Y = CLUSTER_CENTER_Y;
const LEFT_BOX_X = 58;
const RIGHT_BOX_X = WIDTH - 58;

const YOUR_ROW_Y = 372;
const SORT_BUTTON_Y = 402;
const FAN_BASELINE_Y = 620;
const ACTION_BUTTON_Y = HEIGHT - 130;
const REDIST_LOG_BUTTON_Y = HEIGHT - 30;

const FAN_CONFIG: FanConfig = {
  perCardStepDeg: tune.handFanPerCardStepDeg,
  maxSpreadDeg: tune.handFanMaxSpreadDeg,
  radius: tune.handFanRadius,
  cardWidth: tune.handFanCardWidth,
  cardHeight: tune.handFanCardHeight,
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
const COLOR_PANEL_EMPTY = 0x121218;
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

function cardLabel(id: CardId): string {
  const card = cardById(id);
  return `${card.name} [${GOD_DISPLAY_NAME[card.god]} ${card.rank}]`;
}

function shortCardLabel(id: CardId): string {
  const card = cardById(id);
  return `${GOD_ABBR[card.god]}\n${card.rank}`;
}

// Never reveals another player's facedown (offsuit) card, regardless of
// what `play.cards` technically contains. host/mask.ts currently sends
// the real card id for offsuit plays to every peer (a pre-existing
// masking gap that predates this stage - fixing it belongs in mask.ts,
// which is out of scope here per BRIEF.md's "no masking/networking
// changes" rule for Stage 3a). This is a presentation-only safeguard so
// the new play-area boxes and log view don't visually leak it even
// though the payload already has it. Your own plays are always shown
// plainly - no privacy concern in seeing your own card.
function maskedPlayText(play: MaskedTrickPlay, yourSlot: NetPlayerId, formatter: (id: CardId) => string): string {
  if (play.kind === 'offsuit' && play.player !== yourSlot) return 'Facedown card';
  return play.cards.map(formatter).join(' + ');
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

  const rect = (x: number, y: number, w: number, h: number, fill: number, alpha = 1): Phaser.GameObjects.Rectangle => {
    const r = scene.add.rectangle(x, y, w, h, fill, alpha);
    container.add(r);
    return r;
  };

  const text = (x: number, y: number, str: string, color = '#eeeeee', size = 12, align = 'center'): Phaser.GameObjects.Text => {
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

  if (ui.overlay !== 'none') {
    renderOverlay(state, ui.overlay, ui, rerender, rect, text, button);
    return;
  }

  if (state.winner) {
    renderGameOver(state, rect, text, button, ui, rerender);
    return;
  }

  renderTopBar(state, ui, rerender, rect, text, button);
  const suitRing = renderPlayerCluster(scene, container, state, view, rerender, rect, text);
  renderYourRow(state, suitRing, rect, text, circle);
  renderSortButton(ui, rerender, button);
  const legality = state.turnPhase === 'play' ? computeHandLegality(state, view.selectedCards) : null;
  renderCardFan(scene, container, state, view, ui, legality, rerender);
  renderActionButton(state, view, legality, sendAction, rerender, button);
  renderRedistLogStub(ui, rerender, button);
}

// --- Top bar ----------------------------------------------------------

function renderTopBar(
  state: MaskedState,
  ui: PersistentUIState,
  rerender: () => void,
  rect: (x: number, y: number, w: number, h: number, fill: number, alpha?: number) => Phaser.GameObjects.Rectangle,
  text: (x: number, y: number, str: string, color?: string, size?: number, align?: string) => Phaser.GameObjects.Text,
  button: ButtonFn,
): void {
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
      return BOTTOM_BOX_Y - PLAY_AREA_H / 2 - 16;
    case 'right':
    case 'left':
      return SIDE_BOX_Y + SIDE_PLAY_AREA_H / 2 + 16;
  }
}

function renderPlayerCluster(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  state: MaskedState,
  view: ViewState,
  rerender: () => void,
  rect: (x: number, y: number, w: number, h: number, fill: number, alpha?: number) => Phaser.GameObjects.Rectangle,
  text: (x: number, y: number, str: string, color?: string, size?: number, align?: string) => Phaser.GameObjects.Text,
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
    const w = seat === 'top' || seat === 'bottom' ? PLAY_AREA_W : SIDE_PLAY_AREA_W;
    const h = seat === 'top' || seat === 'bottom' ? PLAY_AREA_H : SIDE_PLAY_AREA_H;
    const { x, y } = seatCenter(seat);

    renderPlayArea(scene, container, state, view, pid, x, y, w, h, redistCtx, rerender, rect, text);

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
      const hit = rect(x, tagY, w, 20, staged ? 0x4a3a1a : 0x22222a, staged ? 0.9 : 0.001);
      hit.setInteractive({ useHandCursor: true });
      bindTapIntent(hit, () => {
        view.delegateChoice = pid;
        rerender();
      });
      container.bringToTop(tagText);
    }

    if (isTurn) {
      const dot = scene.add.circle(x - w / 2 - 10, tagY, 4, COLOR_TURN_DOT);
      container.add(dot);
    }
    if (isStarter) {
      const dot = scene.add.circle(x + w / 2 + 10, tagY, 4, COLOR_STARTER_DOT);
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

// One opponent/own play-area box: shows this trick's play (masked for
// offsuit plays that aren't yours - see maskedPlayText), or, when this
// player is owed a redistribution gift and *you're* the one performing
// it, swaps to a "have/need" counter and becomes a tap target for the
// currently-staged candidate card (see BRIEF.md's "Redistribution flow").
function renderPlayArea(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  state: MaskedState,
  view: ViewState,
  pid: NetPlayerId,
  x: number,
  y: number,
  w: number,
  h: number,
  redistCtx: MaskedState['redistribution'],
  rerender: () => void,
  rect: (x: number, y: number, w: number, h: number, fill: number, alpha?: number) => Phaser.GameObjects.Rectangle,
  text: (x: number, y: number, str: string, color?: string, size?: number, align?: string) => Phaser.GameObjects.Text,
): void {
  const contribution = redistCtx?.contributions.find((c) => c.player === pid) ?? null;

  if (redistCtx && contribution) {
    const have = (view.redistributeAssignment[pid] ?? []).length;
    const need = contribution.count;
    const fulfilled = have >= need;
    const box = rect(x, y, w, h, fulfilled ? 0x1a3a22 : COLOR_PANEL, 1);
    box.setStrokeStyle(1, fulfilled ? 0x4a8a5a : COLOR_PANEL_BORDER);
    text(x, y, `${have}/${need}`, fulfilled ? '#88ff99' : '#dddddd', 15);
    const canAssign = !fulfilled && view.selectedCards.length === 1;
    if (canAssign) {
      box.setInteractive({ useHandCursor: true });
      bindTapIntent(box, () => {
        const cardId = view.selectedCards[0];
        const list = view.redistributeAssignment[pid] ?? [];
        view.redistributeAssignment[pid] = [...list, cardId];
        view.selectedCards = [];
        rerender();
      });
    }
    return;
  }

  const play = state.currentTrick.find((p) => p.player === pid) ?? null;
  const box = rect(x, y, w, h, play ? COLOR_PANEL : COLOR_PANEL_EMPTY, 1);
  box.setStrokeStyle(1, COLOR_PANEL_BORDER);
  if (play) {
    text(x, y, maskedPlayText(play, state.yourSlot, shortCardLabel), '#eeeeee', 11);
  } else {
    text(x, y, '—', '#444450', 14);
  }
  void scene;
  void container;
}

// --- Your row: starter indicator, name tag, team tag -------------------

function renderYourRow(
  state: MaskedState,
  suitRing: ReturnType<typeof computeSuitRing>,
  rect: (x: number, y: number, w: number, h: number, fill: number, alpha?: number) => Phaser.GameObjects.Rectangle,
  text: (x: number, y: number, str: string, color?: string, size?: number, align?: string) => Phaser.GameObjects.Text,
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

  hand.forEach((id, i) => {
    const { x, y, rotationDeg } = layouts[i];

    let cardState: CardVisualState | null = null;
    if (inPlayPhase && legality) cardState = legality.states.get(id) ?? null;
    else if (inRedistributePhase) cardState = redistributeCardState(id, assignedIds, stagedId);

    const color = cardState ? colorFor(cardState) : '#cccccc';
    const fill = cardState === 'selected' ? 0x3a3320 : cardState === 'partner' ? 0x1c3a3a : cardState === 'illegal' ? 0x18181c : COLOR_PANEL;

    const cardContainer = scene.add.container(x, y);
    cardContainer.setRotation((rotationDeg * Math.PI) / 180);
    container.add(cardContainer);

    const box = scene.add.rectangle(0, 0, FAN_CONFIG.cardWidth, FAN_CONFIG.cardHeight, fill, 1);
    box.setStrokeStyle(1, cardState === 'illegal' ? 0x2a2a30 : 0x55555f);
    cardContainer.add(box);

    const card = cardById(id);
    const label = scene.add
      .text(0, 0, `${GOD_ABBR[card.god]}\n${card.rank}`, {
        fontFamily: FONT,
        fontSize: '11px',
        color,
        align: 'center',
        resolution: PIXEL_RATIO,
      })
      .setOrigin(0.5);
    cardContainer.add(label);

    const canTapPlay = inPlayPhase && legality && cardState !== 'illegal' && cardState !== null;
    const canTapRedistribute = inRedistributePhase && cardState !== 'illegal';
    if (canTapPlay) {
      box.setInteractive({ useHandCursor: true });
      bindTapIntent(box, () => {
        view.selectedCards = nextSelectionAfterTap(view.selectedCards, id, cardState as CardVisualState, legality!);
        rerender();
      });
    } else if (canTapRedistribute) {
      box.setInteractive({ useHandCursor: true });
      bindTapIntent(box, () => {
        view.selectedCards = stagedId === id ? [] : [id];
        rerender();
      });
    }
  });
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
// earlier task), Rules and Redistribution-log stubs (real design comes
// from Claude Design + DOM overlays in Stage 3c - see BRIEF.md) ---------

function renderOverlay(
  state: MaskedState,
  kind: Exclude<OverlayKind, 'none'>,
  ui: PersistentUIState,
  rerender: () => void,
  rect: (x: number, y: number, w: number, h: number, fill: number, alpha?: number) => Phaser.GameObjects.Rectangle,
  text: (x: number, y: number, str: string, color?: string, size?: number, align?: string) => Phaser.GameObjects.Text,
  button: ButtonFn,
): void {
  rect(CENTER_X, HEIGHT / 2, WIDTH, HEIGHT, 0x0c0c10, 1);
  const title = kind === 'log' ? 'Previous Trick' : kind === 'rules' ? 'Rules' : 'Redistribution Log';
  text(CENTER_X, 50, title, '#ffcc66', 16);

  if (kind === 'log') {
    renderPreviousTrickOverlay(state, text);
  } else if (kind === 'rules') {
    text(CENTER_X, HEIGHT / 2 - 20, 'Rules - coming in a later pass.', '#999999', 12);
  } else {
    text(CENTER_X, HEIGHT / 2 - 20, 'Redistribution log - coming in a later pass.', '#999999', 12);
  }

  button(CENTER_X, HEIGHT - 60, 120, 36, 'Close', () => {
    ui.overlay = 'none';
    rerender();
  });
}

// Item 2 (earlier task): the trick immediately before the one in progress,
// with per-card player attribution, in play order - never full game
// history. `state.previousTrick` already carries exactly that (see
// host/mask.ts), so this is pure presentation. Masked the same way as the
// live play-area boxes (see maskedPlayText) so a facedown card played
// last trick doesn't become visible in the log after the fact.
function renderPreviousTrickOverlay(
  state: MaskedState,
  text: (x: number, y: number, str: string, color?: string, size?: number, align?: string) => Phaser.GameObjects.Text,
): void {
  if (!state.previousTrick) {
    text(CENTER_X, 100, 'No previous trick yet.', '#777777', 12);
    return;
  }
  state.previousTrick.forEach((play, i) => {
    const label = maskedPlayText(play, state.yourSlot, cardLabel);
    text(CENTER_X, 90 + i * 30, `${seatLabelForNet(state, play.player)}: ${label}`, '#dddddd', 12);
  });
}

// --- Game over --------------------------------------------------------

function renderGameOver(
  state: MaskedState,
  rect: (x: number, y: number, w: number, h: number, fill: number, alpha?: number) => Phaser.GameObjects.Rectangle,
  text: (x: number, y: number, str: string, color?: string, size?: number, align?: string) => Phaser.GameObjects.Text,
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
