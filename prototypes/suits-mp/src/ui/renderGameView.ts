import Phaser from 'phaser';
import { GOD_DISPLAY_NAME, GOD_TEAM, TEAMMATE_GOD, cardById, sortCardIds, sortCardIdsByRank } from '../rules/cards';
import type { CardId, DeityCardState } from '../rules/types';
import { bindTapIntent } from '../input/intents';
import { PIXEL_RATIO } from '../render/pixelRatio';
import { ALL_NET_PLAYER_IDS, fromNetPlayerId } from '../net/netPlayerId';
import type { NetPlayerId } from '../net/netPlayerId';
import type { ClientAction, MaskedState, MaskedTrickPlay } from '../net/actions';
import { colorFor, computeHandLegality, nextSelectionAfterTap } from './handLegality';
import type { CardVisualState } from './handLegality';
import { buildSeatMap, computeSuitRing, seatFor } from './seating';
import type { SeatPosition } from './seating';
import { computeFanLayouts, computeFanScale } from './cardFan';
import type { FanConfig } from './cardFan';
import { drawCard } from './cardComponent';
import type { CardDimensions, CardFace, CardStyle } from './cardComponent';
import { playAwakenedEffect } from './cardArt';
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
// Team/god HUD, Order/Action buttons - which now lives in dom/overlay/
// GameOverlay.tsx rather than being drawn here, driven by
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

// Measured fact, not derivable from the image's raw dimensions or
// estimated from its description - re-measured for the corrected
// production background (1080x1920, a much smaller circular sigil in a
// larger dark-blue cracked-stone field, replacing the old 841x1870
// near-full-canvas sigil the previous fraction below was measured
// against). Method: isolate the sigil's bright linework from the darker
// stone via a luminance threshold (stable across thresholds 70-90 out of
// 255, confirmed by re-running at several thresholds), then take the
// midpoint of that mask's bounding box - the sigil is a clean circle, so
// its bbox midpoint on each axis is its true geometric center. Result:
// bbox x range [253, 825] of 1080 -> mid 539.0 (49.9% of width); y range
// [622, 1198] of 1920 -> mid 910.0 (47.4% of height). Used as a
// "background-position anchor" so the sigil lines up with the DOM-layer
// center wheel (dom/overlay/GameOverlay.tsx's "center-hud", itself pinned
// to this same CENTER_X/CLUSTER_CENTER_Y point - reconfirmed by measuring
// its live getBoundingClientRect() back into canvas-logical coordinates,
// same method as the original alignment fix) rather than literal canvas
// center: the canvas has more UI below its vertical midpoint than above
// it (hand fan, local nameplate, seat bar), so CLUSTER_CENTER_Y sits
// well above HEIGHT / 2, the point a naive fix would anchor to instead.
const TABLETOP_SIGIL_ANCHOR = { x: 0.499, y: 0.474 };

// Positions the tabletop so its sigil anchor lands exactly on the DOM
// wheel's point (CENTER_X, CLUSTER_CENTER_Y), uniformly scaled (never
// stretched independently per-axis) just enough that the image still
// covers every edge of the canvas from that anchor - the same
// "background-size: cover" technique, generalized to an anchor that isn't
// the image's own center. Reads the texture's actual loaded dimensions
// rather than hardcoding them, so a same-named art replacement of a
// different size (art is overwritten in place, never versioned - see root
// CLAUDE.md's art pipeline rules) doesn't silently throw the alignment off
// again the way a hardcoded 841x1870 would.
function drawTabletop(scene: Phaser.Scene, container: Phaser.GameObjects.Container): void {
  if (!scene.textures.exists(TABLETOP_KEY)) return;
  const source = scene.textures.get(TABLETOP_KEY).getSourceImage();
  const srcW = source.width;
  const srcH = source.height;
  const { x: fx, y: fy } = TABLETOP_SIGIL_ANCHOR;

  const scale = Math.max(
    CENTER_X / (fx * srcW),
    (WIDTH - CENTER_X) / ((1 - fx) * srcW),
    CLUSTER_CENTER_Y / (fy * srcH),
    (HEIGHT - CLUSTER_CENTER_Y) / ((1 - fy) * srcH),
  );

  const bg = scene.add
    .image(CENTER_X, CLUSTER_CENTER_Y, TABLETOP_KEY)
    .setOrigin(fx, fy)
    .setDisplaySize(srcW * scale, srcH * scale);
  container.add(bg);
}

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
// SIDE_TAG_TOP/BOTTOM_TAG_TOP), which anchor DOM chrome around these same
// canvas-drawn play areas.
const TOP_BOX_Y = 150;
const CLUSTER_CENTER_Y = 305;
const BOTTOM_BOX_Y = 453;
const SIDE_BOX_Y = CLUSTER_CENTER_Y;
const LEFT_BOX_X = 58;
const RIGHT_BOX_X = WIDTH - 58;

// Re-verified, unchanged at 674 (2026-09-10 team-nameplate-revision task,
// Part 4). The contextual hint panel that used to sit directly above this
// baseline (dom/overlay/GameOverlay.tsx's old "required-suit-banner") was
// deleted outright in the same task (Part 3 - the brief no longer wants
// that scaffolding kept around), and the local nameplate directly above
// grew taller in its place (tune.localNameplateHeight, 89.27 -> 107, per
// that task's own Part 2). Despite the taller nameplate, removing the
// hint panel freed enough room that this baseline needed no adjustment:
// confirmed via real screenshots that both the resting fan and the
// worst-case popped-out/selected card (tune.handFanPopOutDistance +
// handFanPopOutScale) clear the nameplate's new, lower bottom edge with
// comfortable margin, and the bottom Play Card button (grown to
// actionButtonWidth/Height 266x117 once a card is selected) still clears
// the fan's own bottom edge the same way it did before this task -
// resolving the prior nameplate-glow-lead-tag-cleanup task's "fully
// spent" budget note without needing to touch BOTTOM_ROW_BOTTOM either.
const FAN_BASELINE_Y = 674;

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

// Never reveals another player's facedown (offsuit) card. host/mask.ts
// now genuinely masks this at the payload level - another player's
// offsuit play arrives with `cards: []`, so this `kind === 'offsuit'`
// check is defense-in-depth (the client never has the real id to leak in
// the first place) rather than the only thing preventing exposure, as it
// used to be. Your own plays are always shown plainly - no privacy
// concern in seeing your own card. Returns one CardFace per card in the
// play (1 for a normal/offsuit single, 2 for a double) - the shared card
// component (ui/cardComponent.ts) draws whichever face this resolves to,
// so both the live play-area boxes and the previous-trick log render
// identically masked.
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
  return { fill, border, textColor, dimmed: cardState === 'illegal' };
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
  // Trick-result dwell bookkeeping (see presentGameView below) - a plain
  // fingerprint of the last-seen `previousTrick`, and whether any state
  // has been presented yet at all (so the very first state a client ever
  // receives - including a reconnecting peer picking up mid-game - never
  // reads as "a trick just completed").
  lastPreviousTrickKey: string | null;
  hasPresentedOnce: boolean;
  // Non-null while a trick-completion's 2s hold is still pending; holds
  // the most recently received masked state so the hold's own delayed
  // render always shows what's *actually* current once it fires, not a
  // stale snapshot from the moment the hold started.
  pendingHoldMasked: MaskedState | null;
  // Card-play animation bookkeeping (see renderCardFan/renderPlayArea
  // below) - every render of the hand fan records each of its own cards'
  // real computeFanLayouts position here, so that the very next render
  // (once one of those cards has actually left the hand for the play
  // area) can look up exactly where it flew in from, without needing to
  // guess or re-derive a since-removed card's old position. Only the
  // local player's own plays ever use this - remote seats' plays fly in
  // from a fixed nameplate position instead (see
  // REMOTE_NAMEPLATE_ORIGIN), since their hands are never rendered.
  lastHandLayoutsByCardId: Map<CardId, { x: number; y: number; rotationDeg: number }>;
  // Per-seat fingerprint of whichever current-trick play has already been
  // animated in for that seat (or already decided not to animate, e.g. no
  // captured hand origin) - so a play that's already landed doesn't fly
  // in again on every incidental re-render (the trick-result dwell hold's
  // own re-render included), only on the render where it's genuinely new.
  // Keyed by NetPlayerId (whoever's seated there), one entry per seat.
  animatedPlayKeyBySeat: Record<NetPlayerId, string>;
  // Scratch list, rebuilt every render pass: any card just set flying by
  // renderPlayArea this pass gets pushed here instead of being brought to
  // the top of the shared container immediately - renderPlayerCluster
  // (which draws play areas) runs *before* renderCardFan (the hand) in
  // the same pass, so bringing a card to the top of the container at
  // renderPlayArea's own point in that sequence would still leave it
  // rendered *below* every hand card added afterward. renderWithView
  // drains this list (bringing each to the top for real) only once
  // everything else this render pass could possibly draw on top of it -
  // hand fan included - is already in place, which is the only way to
  // actually guarantee "renders above every other element" for the whole
  // flight, not just above whatever existed at the moment it was drawn.
  cardsAnimatingThisRender: Phaser.GameObjects.Container[];
  // "Awakened" preview bookkeeping (see renderCardFan below) - which of
  // the local player's own Dormant Deity Cards, still unplayed in hand,
  // are currently showing their swapped/Powered look because a 10 has
  // already appeared somewhere in the current trick. This is a client-
  // side-only preview of what the real engine's own computeDeityCardState
  // rule (rules/engine.ts) would resolve if that card were played right
  // now - it never feeds back into or predicts real engine state, and a
  // card only ever enters this set once, the first render where the
  // condition becomes true (never re-triggering on a later 10 in the same
  // trick, per the GDD rule that multiple 10s don't stack). Cleared
  // wholesale every time `state.currentTrick` is empty - the exact same
  // trick-scoped boundary the real engine resets its own equivalent
  // tracking at (state.plays, reset the instant a trick's 4th card is
  // played) - so a card that was never played reverts to Dormant for the
  // next trick, and a card that *was* played simply falls out of
  // `state.yourHand` and stops being looked up here at all.
  awakenedHandCardIds: Set<CardId>;
  // End-of-trick "cards to collector" animation bookkeeping (see
  // presentGameView/prepareCollectAnimation/renderCardFan below).
  // `collectAnimatedTrickKey` fires the animation exactly once per
  // distinct completed trick - the same `previousTrickKey` fingerprint
  // presentGameView's own dwell logic already uses, since a completed
  // trick's `previousTrick` is "replaced wholesale, never accumulated"
  // (host/mask.ts) each time a new one resolves, making an unchanged
  // fingerprint a reliable "already handled" guard here too. Two
  // independent call sites both go through this one guard: the dwell's
  // own embedded scheduling (single win, collector known instantly) and
  // a plain per-render check (double win, collector only known once the
  // winner's chosen delegate's `redistribute` action actually resolves -
  // no dwell-like wait applies there).
  collectAnimatedTrickKey: string;
  // Non-null for exactly the one render pass where the local player is
  // the trick's collector and their hand fan must animate the 4 (or 5,
  // on a Twin Awakening double win) incoming cards flying in rather than
  // snapping straight to their final sorted slot - see renderCardFan.
  // Keyed by CardId for a real (faceup) incoming card; a facedown
  // incoming card is looked up the same way (its real id is already in
  // `state.yourHand` by the time this fires, see host/mask.ts's
  // collection step) but rendered from `pendingHandCollectFaces` instead
  // of the id, so its real identity is never actually looked up for
  // drawing purposes - see that field's own doc comment.
  pendingHandCollectOrigins: Map<CardId, { x: number; y: number }> | null;
  // The masked CardFace to render a pending incoming card as WHILE
  // FLYING - computed once, up front, from `previousTrick` via the same
  // `maskedPlayFaces` every other animation in this file already uses,
  // deliberately never from the collector's own (by-then-unmasked)
  // `state.yourHand`. This is what keeps a facedown collected card
  // rendering as the generic card-back for its entire flight into the
  // local player's hand, even though the real id backing it is already
  // sitting in cleartext in `state.yourHand` by the time this animation
  // runs - the animation's own visuals are built exclusively from this
  // pre-masked source, never from that cleartext hand array.
  pendingHandCollectFaces: Map<CardId, CardFace> | null;
}

export function createPersistentUIState(): PersistentUIState {
  return {
    overlay: 'none',
    sortMode: 'suit',
    lastPreviousTrickKey: null,
    hasPresentedOnce: false,
    pendingHoldMasked: null,
    lastHandLayoutsByCardId: new Map(),
    animatedPlayKeyBySeat: { p0: '', p1: '', p2: '', p3: '' },
    cardsAnimatingThisRender: [],
    awakenedHandCardIds: new Set(),
    collectAnimatedTrickKey: '',
    pendingHandCollectOrigins: null,
    pendingHandCollectFaces: null,
  };
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

// Cheap content fingerprint for `previousTrick` (at most 4 small entries) -
// good enough to detect "this is a genuinely different completed trick
// than the one we last saw", which is all presentGameView below needs.
function previousTrickKey(state: MaskedState): string {
  return state.previousTrick ? JSON.stringify(state.previousTrick) : '';
}

// Entry point HostGameScene (its own local render) and PlayerGameScene
// (its network message handler) call instead of renderGameView directly,
// so every client - the host's own screen included - holds the display on
// a just-completed trick for tune.trickResultDwellMs before advancing to
// whatever the next phase's UI actually is (redistribution/chooseDelegate).
//
// This is a client-only presentation delay, never a host-logic one: the
// host keeps resolving and broadcasting real state exactly as fast as it
// always did (see gameHost.ts's settleAutoPhases) - this function only
// ever decides when *this client* renders what it already received, never
// touches game state, and never blocks or waits on the host or any other
// client's own hold. Each client manages its own hold independently.
//
// Detecting "a trick just completed": settleAutoPhases auto-chains through
// the engine's 'trickResult' phase entirely within one synchronous host
// tick (see its own doc comment in gameHost.ts) specifically so it never
// needs a network round-trip - which also means a client *never* receives
// 'trickResult' as its own distinct masked-state update to key off of. The
// only observable signal is diffing consecutive updates: `previousTrick`
// (host/mask.ts's copy of `state.lastTrickResult`) changes to a new,
// different value exactly when a trick resolves, and stays constant for
// the whole chooseDelegate/redistribution phase that follows (trickNumber
// itself doesn't increment until redistribute() completes - see
// rules/engine.ts - so it can't be used for this).
export function presentGameView(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  masked: MaskedState,
  sendAction: (action: ClientAction) => void,
  ui: PersistentUIState,
): void {
  const key = previousTrickKey(masked);
  const justCompletedTrick = ui.hasPresentedOnce && masked.previousTrick !== null && key !== ui.lastPreviousTrickKey;
  ui.lastPreviousTrickKey = key;
  ui.hasPresentedOnce = true;
  // Snapshot BEFORE anything below renders this (or any later) state -
  // see prepareCollectAnimation's own doc comment for why this can't be
  // read fresh from `ui.lastHandLayoutsByCardId` at the point that
  // function actually runs. This is "the hand as of the last render",
  // not necessarily "the hand before this trick's collection" - if the
  // local player's own play was what just ended this trick, that card
  // already left the hand at an *earlier* render (the one right after
  // they played it), so it's correctly absent here too; only a card
  // that's about to be freshly collected into the hand (never one that
  // simply left it by being played) will ever differ from `masked.
  // yourHand` by more than that.
  const oldHandIds = new Set(ui.lastHandLayoutsByCardId.keys());

  if (ui.pendingHoldMasked) {
    // Already holding on an earlier trick-completion - remember the
    // latest state and keep waiting; the pending delayed call below will
    // render it once the hold elapses, never sooner. Not re-triggering a
    // fresh hold here even if this update also carries a further-changed
    // `previousTrick` (bots resolving unusually fast) is deliberate: one
    // 2s hold per visit here is the contract, not a chain of them.
    ui.pendingHoldMasked = masked;
    return;
  }

  if (!justCompletedTrick) {
    renderGameView(scene, container, masked, sendAction, ui);
    // Double-win path for the "cards to collector" animation (see its own
    // doc comment below): the collector isn't known the instant a double
    // win's trick resolves - only once the winner's chosen delegate's
    // `redistribute` action actually goes through, a real player
    // interaction with no dwell-like wait of its own. That moment shows up
    // right here, as an entirely ordinary (non-trick-completing) render
    // where `turnPhase` has just become `'redistribute'` - no special
    // detection needed beyond this cheap, always-false-in-the-common-case
    // check.
    const descriptor = prepareCollectAnimation(masked, oldHandIds, ui);
    if (descriptor) finishCollectAnimation(scene, container, descriptor, ui);
    return;
  }

  // Freeze the display on the trick that just finished. Play areas show
  // its real 4 plays (`previousTrick`) instead of `currentTrick` (already
  // reset) or a redistribution stack (would otherwise appear immediately)
  // - reusing the exact same rendering path a live trick uses, since a
  // finished trick's plays look identical to a live one's. `currentTurn`/
  // `redistribution`/`delegateChoices` are forced to null - the same
  // legitimate "nothing pending right now" values these fields already
  // take on between real decisions, not a fabricated state shape - which
  // disables every interactive element (hand-fan taps, seat-tag delegate
  // picks, the action button) exactly as required: nobody can act during
  // the hold. `yourHand` strips out anything not already in `oldHandIds`
  // (a local collector's newly-collected cards, including a facedown
  // one whose real id is already sitting in `masked.yourHand` in
  // cleartext by now - see host/mask.ts's collection step) rather than
  // using `masked.yourHand` as-is - without this, those cards would
  // already be visible in the hand fan during this static beat, before
  // the collect flight - and this task's own masking requirement - even
  // begins. Filtering `masked.yourHand` down (rather than substituting
  // `oldHandIds` wholesale) keeps this correct for a non-collector too:
  // a card the local player just played themselves to *end* this trick
  // (see `oldHandIds`'s own doc comment) is already, correctly, absent
  // from `masked.yourHand` - substituting `oldHandIds` outright would
  // wrongly resurrect it here. No fading or animation is needed for this
  // to read as "holding" - the frame simply doesn't change until the
  // hold ends.
  const frozen: MaskedState = {
    ...masked,
    yourHand: masked.yourHand.filter((id) => oldHandIds.has(id)),
    currentTrick: masked.previousTrick ?? [],
    redistribution: null,
    currentTurn: null,
    delegateChoices: null,
  };
  renderGameView(scene, container, frozen, sendAction, ui);

  ui.pendingHoldMasked = masked;

  // Single-win path for the "cards to collector" animation: unlike a
  // double win, the collector here is already known the instant the trick
  // resolved (see rules/engine.ts's proceedFromTrickResult - a single
  // win's winner is immediately also its own distributor, with no
  // intervening chooseDelegate decision) - `masked` above already reflects
  // this (it's the real, already-collected "next" state, just not yet
  // rendered). So rather than wait for the dwell to end, embed the whole
  // animation *inside* it: a brief static beat first (the finished trick
  // stays visible/registerable, via the `frozen` render just above), then
  // the collect flight - both must finish well before
  // tune.trickResultDwellMs elapses, per this task's own "do not extend
  // total dwell time" requirement. Consuming `ui.pendingHoldMasked` early
  // here (once the animation actually triggers) makes the *outer*
  // delayedCall below a no-op when it fires later, rather than redundantly
  // re-rendering the exact same already-settled state.
  const wonByDouble = (masked.previousTrick ?? []).some((p) => p.kind === 'double');
  if (!wonByDouble) {
    scene.time.delayedCall(tune.cardCollectStaticBeatMs, () => {
      const latest = ui.pendingHoldMasked;
      if (!latest) return; // a later trick's own hold already consumed/overwrote this
      const descriptor = prepareCollectAnimation(latest, oldHandIds, ui);
      if (descriptor) {
        ui.pendingHoldMasked = null;
        renderGameView(scene, container, latest, sendAction, ui);
        finishCollectAnimation(scene, container, descriptor, ui);
      }
    });
  }

  scene.time.delayedCall(tune.trickResultDwellMs, () => {
    const latest = ui.pendingHoldMasked;
    ui.pendingHoldMasked = null;
    if (latest) renderGameView(scene, container, latest, sendAction, ui);
  });
}

// --- End-of-trick "cards to collector" animation ------------------------
// Marks the end of a trick by visually flying all 4 (or 5, on a double
// win) played cards toward whoever collects them - the trick's winner on
// a single win, or their chosen delegate on a double win. Purely a
// client-side presentation flourish, same category as every other
// animation in this file: never touches host logic, never delays or
// reorders any real state transition, only decides how *this client*
// visualizes a transition it already received. See presentGameView's two
// call sites above for when this fires for each win type.

interface CollectIncomingCard {
  face: CardFace;
  origin: { x: number; y: number };
}

// The 4 (or 5) cards a completed trick's `previousTrick` collects,
// resolved to already-masked CardFaces and each one's own play-area
// origin (the seat that actually played it, from this viewer's own
// perspective) - reuses `maskedPlayFaces` exactly as every other
// animation here does, so a facedown play here is exactly as
// unidentifiable as it already is everywhere else; this is the one and
// only data source both collect-animation branches below draw from.
function computeIncomingCollectCards(previousTrick: MaskedTrickPlay[], yourSlot: NetPlayerId): CollectIncomingCard[] {
  const result: CollectIncomingCard[] = [];
  for (const play of previousTrick) {
    const origin = seatCenter(seatFor(play.player, yourSlot));
    for (const face of maskedPlayFaces(play, yourSlot)) result.push({ face, origin });
  }
  return result;
}

interface CollectAnimationDescriptor {
  isLocalCollector: boolean;
  incoming: CollectIncomingCard[];
  destSeat: 'top' | 'left' | 'right' | null;
}

// Fires at most once per distinct completed trick (see
// PersistentUIState.collectAnimatedTrickKey) - null otherwise, including
// every ordinary re-render of an already-triggered trick's redistribute
// phase (e.g. the collector tapping cards to assign gifts). When it does
// fire for a LOCAL collector, it also seeds
// `ui.pendingHandCollectOrigins`/`pendingHandCollectFaces` - the caller
// must render `state` (via renderGameView) immediately after this returns
// and before calling finishCollectAnimation, so renderCardFan's own
// consumption of those two fields (see below) happens on the right pass.
// `oldHandIds` must be captured by the caller *before* rendering anything
// derived from this same masked-state push (see presentGameView's own
// call sites) - renderCardFan unconditionally overwrites
// `ui.lastHandLayoutsByCardId` to the state it's given every single time
// it runs, so reading that field in here directly would, in every real
// call path, already reflect the very state whose "what's new" this
// function needs to diff against, making every id look pre-existing.
function prepareCollectAnimation(state: MaskedState, oldHandIds: ReadonlySet<CardId>, ui: PersistentUIState): CollectAnimationDescriptor | null {
  if (state.turnPhase !== 'redistribute' || state.currentTurn === null || !state.previousTrick) return null;
  const key = previousTrickKey(state);
  if (key === ui.collectAnimatedTrickKey) return null;
  ui.collectAnimatedTrickKey = key;

  const isLocalCollector = state.currentTurn === state.yourSlot;
  const incoming = computeIncomingCollectCards(state.previousTrick, state.yourSlot);

  if (isLocalCollector) {
    // Real (faceup) incoming cards are keyed directly by their own real
    // id. A facedown incoming card has no id to key by in its own
    // CardFace (by design - see cardComponent.ts's CardFace doc comment)
    // but its real id is already sitting in `state.yourHand` by now (see
    // host/mask.ts's collection step) - recoverable here purely by
    // elimination (every id newly present in `state.yourHand` since the
    // last render, minus every id a *visible* incoming face already
    // named), never by looking at the hidden play's own contents. This
    // recovers WHICH id to key the pending-origin/face maps by, not what
    // it actually is - `pendingHandCollectFaces` still renders it
    // strictly as `{kind:'facedown'}` for the whole flight regardless.
    const newIds = state.yourHand.filter((id) => !oldHandIds.has(id));
    const visibleIncoming = incoming.filter((c) => c.face.kind === 'faceup');
    const hiddenIncoming = incoming.filter((c) => c.face.kind === 'facedown');
    const visibleIds = new Set(visibleIncoming.map((c) => (c.face as { kind: 'faceup'; cardId: CardId }).cardId));
    const hiddenIds = newIds.filter((id) => !visibleIds.has(id));

    const origins = new Map<CardId, { x: number; y: number }>();
    const faces = new Map<CardId, CardFace>();
    for (const c of visibleIncoming) {
      const id = (c.face as { kind: 'faceup'; cardId: CardId }).cardId;
      origins.set(id, c.origin);
      faces.set(id, c.face);
    }
    hiddenIncoming.forEach((c, i) => {
      const id = hiddenIds[i];
      if (!id) return; // defensive - counts should always match; never draw a guessed origin
      origins.set(id, c.origin);
      faces.set(id, { kind: 'facedown' });
    });

    ui.pendingHandCollectOrigins = origins;
    ui.pendingHandCollectFaces = faces;
    return { isLocalCollector: true, incoming, destSeat: null };
  }

  return { isLocalCollector: false, incoming, destSeat: seatFor(state.currentTurn, state.yourSlot) as 'top' | 'left' | 'right' };
}

// Completes whatever prepareCollectAnimation started, once the caller has
// already rendered the state it returned a descriptor for. For a local
// collector this just releases the pending maps renderCardFan already
// consumed while drawing that one render. For a remote collector, the
// preceding render already emptied every play area (state.currentTrick is
// genuinely `[]` by now) - this spawns the 4/5 flying cards on top of that
// already-settled render and tweens them toward the collector's own PLAY
// AREA (2026-09-10 collector-destination-autoreveal task - previously the
// collector's nameplate, via REMOTE_NAMEPLATE_ORIGIN; changed to
// seatCenter's own coordinates instead, deliberately NOT by repointing
// REMOTE_NAMEPLATE_ORIGIN itself, since that shared constant also serves
// as the *origin* for the unrelated remote-seat card-PLAY animation
// further down this file (animateCardPlayIntoPlayArea's own call site) -
// repointing it here would have silently changed that animation's origin
// too), fading out once they arrive (leaving this client's board -
// conceptually moving into a hand it can't see).
function finishCollectAnimation(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  descriptor: CollectAnimationDescriptor,
  ui: PersistentUIState,
): void {
  if (descriptor.isLocalCollector) {
    ui.pendingHandCollectOrigins = null;
    ui.pendingHandCollectFaces = null;
    return;
  }

  const dest = seatCenter(descriptor.destSeat!);
  descriptor.incoming.forEach(({ face, origin }, i) => {
    const style = playAreaStyle(face);
    const drawn = drawCard(scene, container, origin.x, origin.y, 0, face, style, CARD_DIMS_STANDARD);
    // Added strictly after this pass's own render already finished (see
    // this function's own doc comment) - already the topmost children in
    // the container by construction, no deferred bringToTop needed the
    // way the play-area fly-in animation requires (see
    // PersistentUIState.cardsAnimatingThisRender's own doc comment).
    scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: tune.cardCollectTravelMs,
      delay: i * tune.cardCollectStaggerMs,
      ease: tune.cardCollectEase,
      onUpdate: (_tween, _target, _key, t: number) => {
        drawn.container.x = origin.x + (dest.x - origin.x) * t;
        drawn.container.y = origin.y + (dest.y - origin.y) * t - tune.cardCollectArcHeight * Math.sin(Math.PI * t);
      },
      onComplete: () => {
        drawn.container.setPosition(dest.x, dest.y);
        scene.tweens.add({
          targets: drawn.container,
          alpha: 0,
          scale: tune.cardCollectFadeScale,
          duration: tune.cardCollectFadeMs,
          onComplete: () => drawn.container.destroy(),
        });
      },
    });
  });
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
  // Reset for this pass - see PersistentUIState.cardsAnimatingThisRender's
  // own doc comment for why the actual bringToTop happens once, at the
  // very end of this function, instead of at each animation's own point
  // in the sequence below.
  ui.cardsAnimatingThisRender = [];

  // Tabletop treatment - drawn first so it always sits behind every other
  // canvas element this render pass adds (see board/UI requirements: real
  // R2-fetched art, loaded the same manifest-driven way as every card
  // texture - see preloadCardArt).
  drawTabletop(scene, container);

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
  renderPlayerCluster(scene, container, state, view, ui, rerender, text);
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
  });

  // Now that every canvas element this render pass could possibly add is
  // actually in place (play areas, then the hand fan above them - see
  // PersistentUIState.cardsAnimatingThisRender's own doc comment), bring
  // each of this pass's flying cards to the real top of the shared
  // container, once, for real.
  for (const flying of ui.cardsAnimatingThisRender) container.bringToTop(flying);
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

function renderPlayerCluster(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  state: MaskedState,
  view: ViewState,
  ui: PersistentUIState,
  rerender: () => void,
  text: TextFn,
): void {
  const seatMap = buildSeatMap(state.yourSlot);
  const redistCtx = state.redistribution;

  for (const seat of ['top', 'right', 'left', 'bottom'] as const) {
    const pid = seatMap[seat];
    const { x, y } = seatCenter(seat);
    renderPlayArea(scene, container, state, view, ui, seat, pid, x, y, redistCtx, rerender, text);
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
    // The local ('bottom') seat's own name renders on the new two-
    // compartment ui_player_nameplate.png with no "(You)" suffix (see
    // rawPlayerNameFor's own doc comment) - the other three remote seats
    // are unaffected, since playerLabelFor never appended "(You)" to a
    // non-local slot anyway.
    seatLabels[seat] = seat === 'bottom' ? rawPlayerNameFor(state, seatMap[seat]) : playerLabelFor(state, seatMap[seat]);
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
    // 'YOU' replaces the former 'Bound' label per the 2026-09-10 asset
    // handoff's "small runtime YOU marker on the local player's own Deity
    // symbol only" instruction - this chip is exactly that marker's real
    // spot (rendered under the local player's own symbol icon, never
    // beside the player name - see GameOverlay.tsx). The teammate's own
    // chip now carries no label at all, per the 2026-09-10 live-asset-
    // layout-corrections brief's explicit "Remove KIN; the other symbol
    // needs no label" - that brief is the clarification the prior task's
    // BUILD_STATUS.md flagged as still open (it had kept 'Kin' only
    // pending exactly this). Not revealing which remote seat holds the
    // teammate Deity is unaffected: this compartment never showed a seat/
    // player identity to begin with, only the Team's two Deity symbols.
    yourGodChip: { code: SUITS[GOD_TO_SUIT_INDEX[state.yourGod]].code, label: 'YOU', god: state.yourGod },
    teammateGodChip: { code: SUITS[GOD_TO_SUIT_INDEX[teammateGod]].code, label: '', god: teammateGod },
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

// Real screen anchor for each non-local seat's nameplate (dom/overlay/
// GameOverlay.tsx's own TOP_TAG_TOP/SIDE_TAG_TOP + roughly half that tag's
// own ~34px height) - kept in sync with that file by value, the same way
// this module's other row anchors already are (see this file's own
// TOP_BOX_Y/SIDE_BOX_Y/CENTER_X header comment). Used only as the
// remote-seat card-play animation's flight origin - the local player's
// own origin is a real captured hand position instead (see
// PersistentUIState.lastHandLayoutsByCardId), since their hand is the one
// hand this file actually draws. There's no local/bottom entry here on
// purpose: the local player never uses a nameplate origin.
const REMOTE_NAMEPLATE_ORIGIN: Record<'top' | 'left' | 'right', { x: number; y: number }> = {
  top: { x: CENTER_X, y: 67 },
  left: { x: 57, y: 375 },
  right: { x: 333, y: 375 },
};

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
  ui: PersistentUIState,
  seat: SeatPosition,
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
    // Ready for the next real play at this seat to be detected as
    // genuinely new - otherwise a same-fingerprint coincidence across two
    // different tricks (unlikely but not impossible with only 40 cards)
    // could skip its animation.
    ui.animatedPlayKeyBySeat[pid] = '';
    drawCard(scene, container, x, y, 0, { kind: 'empty' }, emptySlotStyle(), CARD_DIMS_STANDARD);
    return;
  }

  // Animate every seat's card play, once - the very first render where
  // this specific play appears. Every subsequent render of this same
  // already-landed play (a re-render for an unrelated reason, including
  // the trick-result dwell hold's own frozen re-render) falls through to
  // the plain, static drawCardRow below. `maskedPlayFaces` (below) has
  // already reduced a hidden offsuit play to a single `{kind:'facedown'}`
  // face with no card id at all by this point - the animation draws
  // exactly that face, so a facedown play can never show real art
  // mid-flight any more than it could at rest.
  const faces = maskedPlayFaces(play, state.yourSlot);
  const key = `${play.player}:${play.cards.join(',')}`;
  if (key !== ui.animatedPlayKeyBySeat[pid]) {
    ui.animatedPlayKeyBySeat[pid] = key;
    const isOwnSeat = pid === state.yourSlot;
    animateCardPlayIntoPlayArea(scene, container, x, y, faces, isOwnSeat ? null : REMOTE_NAMEPLATE_ORIGIN[seat as 'top' | 'left' | 'right'], ui);
    return;
  }

  drawCardRow(scene, container, x, y, faces, CARD_DIMS_STANDARD, playAreaStyle);
}

// Flies a just-played card in from its real origin to the exact same
// final position/rotation/size renderPlayArea always placed it at - this
// only changes the transition INTO that position, never the resting
// result. `remoteOrigin` is null for the local player (whose real
// per-card hand position comes from `ui.lastHandLayoutsByCardId` instead)
// and a fixed nameplate point for the other three seats, whose hands are
// never rendered - both origins feed the exact same flight/timing/easing
// below for visual consistency across all four seats, per the task.
//
// The path is a genuine arc, not a straight line: `t` (0-1, eased) drives
// a manual x/y lerp between origin and landing plus a `sin(pi*t)` bump
// subtracted from y (screen y grows downward, so subtracting lifts the
// card) that peaks at the midpoint - a real toss trajectory, unlike
// tweening `x`/`y` directly to their final values, which Phaser would
// interpolate along a straight line regardless of easing (easing reshapes
// speed over time, never the path itself). A brief scale-punch settle
// beat chains on arrival for impact. Every value affecting the feel here
// lives in tune.json (see BUILD_STATUS.md).
function animateCardPlayIntoPlayArea(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  x: number,
  y: number,
  faces: CardFace[],
  remoteOrigin: { x: number; y: number } | null,
  ui: PersistentUIState,
): void {
  const dims = CARD_DIMS_STANDARD;
  const totalW = faces.length * dims.width + (faces.length - 1) * CARD_GAP;
  let cx = x - totalW / 2 + dims.width / 2;

  for (const face of faces) {
    const finalX = cx;
    const finalY = y;
    cx += dims.width + CARD_GAP;

    const style = playAreaStyle(face);
    const handOrigin = remoteOrigin === null && face.kind === 'faceup' ? ui.lastHandLayoutsByCardId.get(face.cardId) : undefined;
    const origin = remoteOrigin ?? handOrigin;
    const originRotationDeg = handOrigin?.rotationDeg ?? 0;

    if (!origin) {
      // No captured hand position for this local card - not expected for
      // a genuine local play (maskedPlayFaces always resolves the local
      // player's own play to real faceup ids), but a safe fallback for an
      // edge case like a page reload mid-trick: land directly rather than
      // animating from a guessed/default point.
      drawCard(scene, container, finalX, finalY, 0, face, style, dims);
      continue;
    }

    const drawn = drawCard(scene, container, origin.x, origin.y, originRotationDeg, face, style, dims);
    // Must render above every other element for the whole flight,
    // including the hand fan, which this same render pass draws *after*
    // play areas - bringToTop right now would only clear whatever's
    // already in the container at this point, not what's still to come.
    // Queued and actually brought to the top once, at the very end of
    // this whole render pass - see PersistentUIState.cardsAnimatingThisRender.
    ui.cardsAnimatingThisRender.push(drawn.container);

    const originRotationRad = (originRotationDeg * Math.PI) / 180;
    scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: tune.cardPlayTravelMs,
      ease: tune.cardPlayTravelEase,
      onUpdate: (_tween, _target, _key, t: number) => {
        drawn.container.x = origin.x + (finalX - origin.x) * t;
        drawn.container.y = origin.y + (finalY - origin.y) * t - tune.cardPlayArcHeight * Math.sin(Math.PI * t);
        drawn.container.setRotation(originRotationRad * (1 - t));
      },
      onComplete: () => {
        // Land pixel-exact regardless of any float residue from the
        // manual lerp above.
        drawn.container.setPosition(finalX, finalY);
        drawn.container.setRotation(0);
        scene.tweens.add({
          targets: drawn.container,
          scaleX: tune.cardPlayPunchScale,
          scaleY: tune.cardPlayPunchScale,
          duration: tune.cardPlayPunchMs,
          ease: tune.cardPlayPunchEase,
          yoyo: true,
          onComplete: () => {
            // Scenario 2 of the "Awakened" reveal (see cardArt.ts's
            // playAwakenedEffect doc comment): another player's play that
            // already resolved Powered before it ever reached this
            // client - never the local player's own seat, whose Deity
            // Card either already got this treatment back when it was
            // still an eligible hand card (see renderCardFan), or has no
            // captured hand origin at all (the `!origin` fallback above,
            // which never reaches this tween in the first place). Fires
            // only once the whole landing sequence - travel, then this
            // punch - has fully settled, per the task's own "sequenced
            // AFTER it finishes landing" requirement. No underlying art
            // swap here: `face.deityCardState` already resolved Powered
            // before this card was ever drawn, so the real static art
            // this burst plays on top of was already correct from its
            // very first frame.
            if (remoteOrigin !== null && face.kind === 'faceup' && face.deityCardState === 'powered') {
              playAwakenedEffect(scene, drawn.container, cardById(face.cardId).god, dims);
            }
          },
        });
      },
    });
  }
}

// Flips a just-collected, previously-facedown hand card to reveal its
// real identity, once it's already landed at its final hand slot (see
// renderCardFan's own reflow-tween onComplete, the only caller) - a
// genuine "you couldn't see this until now" reveal, not just a
// flourish. The masked identity host/mask.ts withholds is about hiding
// an off-suit play from *opponents* while it sits in the trick; the
// real id is already sitting in `state.yourHand` (hence `MaskedState.
// yourHand`) the instant it's collected into the local player's own
// hand - see prepareCollectAnimation's own doc comment for how this
// file already recovers that id by elimination. This function only
// decides how the client shows that already-known transition, rather
// than the previous behavior of leaving the card drawn facedown
// (baked in at reflow-draw time, never updated) until whatever
// unrelated render happened to come along next silently redrew it
// correctly with no transition at all.
//
// A classic scale-through-zero flip: the still-facedown container
// shrinks to nothing on the X axis, is swapped for a freshly-drawn
// faceup container at the exact same position/rotation, then grows
// back out - the swap itself happens at the invisible zero-width
// midpoint, so a facedown/faceup blend is never visible mid-transition.
function playCardRevealFlip(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  oldContainer: Phaser.GameObjects.Container,
  x: number,
  y: number,
  rotationRad: number,
  style: CardStyle,
  dims: CardDimensions,
  cardId: CardId,
  deityCardState: DeityCardState | null,
): void {
  const halfMs = tune.cardRevealFlipMs / 2;
  scene.tweens.add({
    targets: oldContainer,
    scaleX: 0,
    duration: halfMs,
    ease: tune.cardRevealFlipEase,
    onComplete: () => {
      oldContainer.destroy();
      const revealed = drawCard(scene, container, x, y, (rotationRad * 180) / Math.PI, { kind: 'faceup', cardId, deityCardState }, style, dims);
      revealed.container.setScale(0, 1);
      scene.tweens.add({
        targets: revealed.container,
        scaleX: 1,
        duration: halfMs,
        ease: tune.cardRevealFlipEase,
      });
    },
  });
}

// Draws 1-2 cards (a play is 1 card for normal/offsuit, 2 for a double)
// centered as a row at (x, y) - shared by play areas and the
// previous-trick log, since both need to show a multi-card play as a
// small side-by-side group rather than a single card.
//
// A single card (the common case) is unchanged: full width, no overlap.
// Multiple cards (currently only ever 2, a Double) overlap significantly
// instead of sitting side by side at full width + CARD_GAP - a
// non-overlapping row of 2 standard-size cards is wide enough to run off
// the left/right seats' play areas, which sit close to the screen edges
// (see BUILD_STATUS.md). Later cards are added to the container after
// earlier ones, so Phaser's own display-list order already draws them
// front-to-back left-to-right with no extra depth/z-index bookkeeping
// needed - this only had to change *spacing*, not draw order. Kept
// general to `faces.length` (a loop, not "2 cards" hardcoded) even
// though nothing currently calls this with more than 2, per the task's
// own instruction. `tune.doublePlayOverlapFraction` is how much of each
// card's width the *next* card covers - tuned low enough that the
// covered card's own rank glyph/god symbol (both left-of-center in the
// Card Frame art - see cardArt.ts's RUNTIME_RANK_CENTER/SYMBOL_BOX) stays
// legible in the visible strip, confirmed visually at the left/right
// seats specifically (the tightest fit) - see BUILD_STATUS.md.
function drawCardRow(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  x: number,
  y: number,
  faces: CardFace[],
  dims: CardDimensions,
  styleFor: (face: CardFace) => CardStyle,
): void {
  const step = faces.length > 1 ? dims.width * (1 - tune.doublePlayOverlapFraction) : dims.width + CARD_GAP;
  const totalW = dims.width + (faces.length - 1) * step;
  let cx = x - totalW / 2 + dims.width / 2;
  for (const face of faces) {
    drawCard(scene, container, cx, y, 0, face, styleFor(face), dims);
    cx += step;
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

  // End-of-trick "cards to collector" animation (see
  // PersistentUIState.pendingHandCollectOrigins's own doc comment):
  // captured *before* the unconditional overwrite below replaces it with
  // this render's own fresh layout, so a card that was already in hand
  // last render can tween from where it actually sat then, not snap.
  // Only non-null for the one render prepareCollectAnimation seeds it for
  // (a local-collector trick just resolved) - every other render behaves
  // exactly as before this task, snapping straight to the fresh layout.
  const oldHandLayouts = ui.lastHandLayoutsByCardId;
  const collectOrigins = ui.pendingHandCollectOrigins;
  const collectFaces = ui.pendingHandCollectFaces;

  // "Awakened" preview (see PersistentUIState.awakenedHandCardIds's own
  // doc comment): an empty currentTrick is the exact same trick-scoped
  // reset boundary the real engine uses for its own equivalent tracking,
  // so clearing here on every such render is idempotent and always
  // correct - it's true both at the very start of a fresh trick (nothing
  // should be showing Powered yet) and right after a real reset (nothing
  // that went unplayed should keep showing it). Note the trick-result
  // dwell hold (presentGameView) substitutes `previousTrick` into
  // `currentTrick` for its frozen render, which is never empty for a
  // trick that actually completed - so a still-unplayed Awakened card
  // keeps showing its swapped look throughout the dwell, and only reverts
  // once the real *next* state (now between tricks) renders for real.
  // Only ever grown by one Deity Card id at a time below, capped at the
  // 4 Deity Cards that exist in the whole game, so this never needs
  // pruning beyond this wholesale clear.
  const newlyAwakenedThisRender = new Set<CardId>();
  if (state.currentTrick.length === 0) {
    ui.awakenedHandCardIds.clear();
  } else {
    const tenAlreadyPlayed = state.currentTrick.some((play) => play.cards.some((id) => cardById(id).rank === 10));
    // Scenario 1 also requires the local player to not have taken their
    // own turn yet this trick (2026-09-10 action-glow-awakened-trigger
    // task) - without this, the preview wrongly fired on the local
    // player's own 10 play (their play is what just made tenAlreadyPlayed
    // true) and kept firing on later renders after they'd already played,
    // even though by then they have nothing left to act on until the next
    // trick's reset (see this block's own currentTrick.length === 0
    // clear above).
    const localPlayerAlreadyPlayed = state.currentTrick.some((play) => play.player === state.yourSlot);
    if (tenAlreadyPlayed && !localPlayerAlreadyPlayed) {
      for (const id of state.yourHand) {
        if (cardById(id).rank === 'DeityCard' && !ui.awakenedHandCardIds.has(id)) {
          ui.awakenedHandCardIds.add(id);
          newlyAwakenedThisRender.add(id);
        }
      }
    }
  }

  const isYourTurn = state.currentTurn === state.yourSlot;
  const inPlayPhase = isYourTurn && state.turnPhase === 'play';
  const inRedistributePhase = state.redistribution !== null;
  const assignedIds = new Set(Object.values(view.redistributeAssignment).flat());
  const stagedId = view.selectedCards.length === 1 ? view.selectedCards[0] : null;

  // computeFanScale checks the outermost cards' actual rendered edges
  // (rotated-rectangle bounding box, not just their center x) against the
  // real screen width, and returns how much to shrink both the radius and
  // the card size together to keep those edges on-screen - see its own
  // header comment in cardFan.ts. It's a no-op (returns 1) whenever
  // `FAN_CONFIG`'s own tuned values already fit a hand of this size, so a
  // normal ~10-card hand only compacts as much as the invariant actually
  // requires, and larger hands (redistribution can inflate a hand well
  // past 10 - see BUILD_STATUS.md) get progressively more compact rather
  // than clipped. Uses a worst-case (popped-out-size) card footprint since
  // *any* card in the fan, including an outermost one, can end up popped
  // out and selected (see poppedOut below) - the edge invariant has to
  // hold for that case too, not just the resting state.
  const fanScale = computeFanScale(
    hand.length,
    CENTER_X,
    { ...FAN_CONFIG, cardWidth: FAN_CONFIG.cardWidth * tune.handFanPopOutScale, cardHeight: FAN_CONFIG.cardHeight * tune.handFanPopOutScale },
    { screenWidth: WIDTH, edgeMarginPx: tune.handFanEdgeMarginPx },
  );
  const scaledFanConfig: FanConfig = { ...FAN_CONFIG, radius: FAN_CONFIG.radius * fanScale };
  const scaledDims: CardDimensions = {
    width: CARD_DIMS_STANDARD.width * fanScale,
    height: CARD_DIMS_STANDARD.height * fanScale,
    fontSize: CARD_DIMS_STANDARD.fontSize * fanScale,
  };
  // Pivot is offset below the visible fan by exactly the radius actually
  // used for layout (the scaled one) - not the base tune.json radius - so
  // the center card (angle 0) always lands on FAN_BASELINE_Y regardless of
  // how much `fanScale` compacted the fan; using the unscaled radius here
  // would shift the whole fan up/down by the scale difference instead of
  // just compacting it in place.
  const layouts = computeFanLayouts(hand.length, CENTER_X, FAN_BASELINE_Y + scaledFanConfig.radius, scaledFanConfig);

  const entries: FanEntry[] = hand.map((id, i) => {
    let cardState: CardVisualState | null = null;
    if (inPlayPhase && legality) cardState = legality.states.get(id) ?? null;
    else if (inRedistributePhase) cardState = redistributeCardState(id, assignedIds, stagedId);
    return { id, x: layouts[i].x, y: layouts[i].y, rotationDeg: layouts[i].rotationDeg, cardState };
  });

  // Recorded on every render, unconditionally - see
  // PersistentUIState.lastHandLayoutsByCardId's own doc comment. Whatever
  // card leaves the hand this trick was necessarily still in it at the
  // immediately preceding render, so this is always fresh by the time
  // renderPlayArea (called earlier in this same render pass, before this
  // function runs - see renderWithView) needs to look up where a
  // just-played card flew in from.
  ui.lastHandLayoutsByCardId = new Map(entries.map((e) => [e.id, { x: e.x, y: e.y, rotationDeg: e.rotationDeg }]));

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
          width: scaledDims.width * tune.handFanPopOutScale,
          height: scaledDims.height * tune.handFanPopOutScale,
          fontSize: scaledDims.fontSize,
        }
      : scaledDims;
    const style = handCardStyle(entry.cardState);
    // `ui.awakenedHandCardIds` is the only source of a Dormant hand card's
    // Powered look - see this function's own trigger-detection block
    // above. A card never carries `deityCardState` from anywhere else
    // while sitting in a hand (the real engine only resolves it once a
    // card is actually played - see cardComponent.ts's CardFace doc
    // comment), so this client-side preview is deliberately the only
    // place a hand card's face can show Powered art at all.
    const deityCardState = ui.awakenedHandCardIds.has(entry.id) ? 'powered' : null;
    // `collectFaces` overrides a pending incoming card's face for its
    // whole flight (facedown for a masked collected card, real faceup
    // otherwise) - see PersistentUIState.pendingHandCollectFaces's own
    // doc comment for why this, and never the id itself, is the source of
    // truth for whether a card is drawn facedown here.
    const face: CardFace = collectFaces?.get(entry.id) ?? { kind: 'faceup', cardId: entry.id, deityCardState };
    // Reflow origin (see PersistentUIState.pendingHandCollectOrigins's own
    // doc comment) - gated strictly on `reflowing` (this render is the
    // one prepareCollectAnimation seeded), never merely on whether
    // `oldHandLayouts` happens to already have this id: on any ordinary
    // render, EVERY already-in-hand card trivially has an entry in
    // `oldHandLayouts` too (it barely moved since last render), which
    // would otherwise wrongly re-trigger this whole tween on every normal
    // render instead of just the one collect render. An incoming card's
    // origin is its own play-area seat (from `collectOrigins`); an
    // already-in-hand card's origin is wherever it actually sat last
    // render (from `oldHandLayouts`) - `reflowOrigin` is `undefined` for
    // both outside a collect render, and also for a genuinely brand-new
    // hand's very first-ever render (nothing to reflow from yet).
    const reflowing = collectOrigins !== null;
    const isIncoming = reflowing && collectOrigins!.has(entry.id);
    const reflowOrigin = reflowing ? (isIncoming ? collectOrigins!.get(entry.id) : oldHandLayouts.get(entry.id)) : undefined;
    const originRotationDeg = isIncoming ? entry.rotationDeg : oldHandLayouts.get(entry.id)?.rotationDeg ?? entry.rotationDeg;
    const { container: drawnContainer, hitArea } = drawCard(
      scene,
      container,
      reflowOrigin?.x ?? entry.x,
      reflowOrigin?.y ?? y,
      reflowOrigin ? originRotationDeg : entry.rotationDeg,
      face,
      style,
      dims,
    );
    if (reflowOrigin) {
      const originRotationRad = (originRotationDeg * Math.PI) / 180;
      const finalRotationRad = (entry.rotationDeg * Math.PI) / 180;
      // Existing cards just shuffling to a new slot get a flat slide (no
      // arc - they're not coming from the table); incoming cards get the
      // same mild arc as every other "coming from the table" flight in
      // this file, for one cohesive motion rather than two disconnected
      // ones (per this task's own requirement) - both share the exact
      // same duration/easing either way.
      const arcHeight = isIncoming ? tune.cardCollectArcHeight : 0;
      const delay = isIncoming ? Array.from(collectOrigins!.keys()).indexOf(entry.id) * tune.cardCollectStaggerMs : 0;
      scene.tweens.addCounter({
        from: 0,
        to: 1,
        duration: tune.cardCollectTravelMs,
        delay: Math.max(0, delay),
        ease: tune.cardCollectEase,
        onUpdate: (_tween, _target, _key, t: number) => {
          drawnContainer.x = reflowOrigin.x + (entry.x - reflowOrigin.x) * t;
          drawnContainer.y = reflowOrigin.y + (y - reflowOrigin.y) * t - arcHeight * Math.sin(Math.PI * t);
          drawnContainer.setRotation(originRotationRad + (finalRotationRad - originRotationRad) * t);
        },
        onComplete: () => {
          drawnContainer.setPosition(entry.x, y);
          drawnContainer.setRotation(finalRotationRad);
          // A just-collected card that was masked facedown while it sat
          // in the trick - see playCardRevealFlip's own doc comment for
          // why this is safe to reveal now (the real id is already
          // `entry.id`, this file already had to recover it to get this
          // far - see prepareCollectAnimation) and why a flip, not an
          // instant swap. Only ever true for `isIncoming` cards (an
          // already-resident card reflowing to a new fan slot never had
          // a masked face to begin with).
          if (isIncoming && face.kind === 'facedown') {
            playCardRevealFlip(scene, container, drawnContainer, entry.x, y, finalRotationRad, style, dims, entry.id, deityCardState);
          }
        },
      });
    }
    // Fires once, only on the render where this specific card just became
    // eligible (see newlyAwakenedThisRender above) - every later render of
    // this same already-swapped card takes the branch above with no
    // burst, matching the "multiple 10s don't stack, no re-trigger" rule.
    if (newlyAwakenedThisRender.has(entry.id)) {
      playAwakenedEffect(scene, drawnContainer, cardById(entry.id).god, dims);
    }

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

// Same absolute name resolution as playerLabelFor above, without its
// "(You)" suffix - the local player's own two-compartment nameplate
// (ui_player_nameplate.png, 2026-09-10 player-UI-asset-wave handoff) shows
// the runtime player name plain, per that handoff's explicit "never
// append (You) to the player name" instruction. Scoped to just the seat-
// label computation below (not a change to playerLabelFor itself), so
// every other consumer of playerLabelFor (the delegate-target action
// button label, the Redistribution Log, the Game Over identity reveal)
// keeps its existing "(You)" behavior unchanged - none of those were
// named by the handoff.
function rawPlayerNameFor(state: MaskedState, id: NetPlayerId): string {
  const name = state.seatNames[id]?.trim();
  return name || `Player ${fromNetPlayerId(id) + 1}`;
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
