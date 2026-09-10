import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import './GameOverlay.css';
import { SEAT_DEG, SEAT_ORDER, SUITS } from './overlayContent';
import type { GodChipState, SeatDelegateState } from './gameOverlayStore';
import type { SeatPosition } from '../../ui/seating';
import { GOD_MOTIF } from '../../rules/godArt';
import { GOD_DISPLAY_NAME } from '../../rules/cards';
import type { God } from '../../rules/types';
import { HEX_CLIP_PATH, currentTurnPointerUrl, nameplateUrl, suitCycleBezelUrl, symbolArtUrl } from '../godArtUrl';
import tune from '../../../tune.json';

// Ported from the Claude Design handoff (`Suit of Madness Overlay.dc.html`).
// Every value here is real: seatLabels/currentTurnSeat/starterSeat/
// leadGodIndex/teamName/the god chips are all computed from the live
// MaskedState by ui/renderGameView.ts and threaded through
// gameOverlayStore.ts - this component only renders them plus two small
// bits of pure presentation bookkeeping:
//
// - useForwardRotation (below) turns a real 0-3 seat/suit-cycle index
//   into cumulative rotation degrees, so the turn wheel and Suit Cycle
//   HUD always turn forward and never snap back, even though the
//   underlying index just wraps 0->3->0. currentTurnSeat/leadGodIndex
//   coming back `null` (indeterminate - e.g. between tricks, or an
//   opponent is about to lead but hasn't committed) freezes the wheel at
//   its last real position rather than snapping to a default.
// - Real per-seat delegate-selection tap targets (`seatDelegate`): during
//   the selectDelegate phase, tapping another seat's name tag is the
//   real (and only) way to choose who performs a redistribution - see
//   gameOverlayStore.ts's header comment for why this stays wired
//   directly rather than going through some intermediate placeholder.
//
// This replaces the equivalent Phaser-drawn HUD that used to live in
// ui/renderGameView.ts's renderPlayerCluster/renderYourRow (removed) -
// the "Order" and "Action" buttons here are the same real controls that
// lived there too, just re-skinned to match the design.

export interface GameOverlayProps {
  sortLabel: string;
  onToggleSort: () => void;
  actionLabel: string;
  actionHint: string;
  actionEnabled: boolean;
  onAction: () => void;
  onOpenRedistLog: () => void;
  onOpenMenu: () => void;
  seatDelegate: Record<SeatPosition, SeatDelegateState>;
  seatLabels: Record<SeatPosition, string>;
  currentTurnSeat: SeatPosition | null;
  starterSeat: SeatPosition | null;
  leadGodIndex: number | null;
  teamName: string;
  yourGodChip: GodChipState;
  teammateGodChip: GodChipState;
  requiredSuitGod: God | null;
}

// Accumulates forward-only rotation degrees from a real 0..order-1 index
// that may jump straight from one value to another (never animating
// through intermediate ones) and may go `null` (indeterminate - freeze at
// the last known position). `stepDeg` is the rotation applied per forward
// step around the cycle (positive to rotate clockwise, negative
// counter-clockwise - the turn wheel and Suit Cycle HUD each need one).
function useForwardRotation(index: number | null, order: number, stepDeg: number): number {
  const [rotation, setRotation] = useState<number>(() => (index ?? 0) * stepDeg);
  const prevIndexRef = useRef<number | null>(index);

  useEffect(() => {
    const prev = prevIndexRef.current;
    if (index === null || index === prev) return;
    if (prev === null) {
      // First real value after being indeterminate (including at mount) -
      // jump straight there rather than accumulating from an arbitrary
      // starting guess.
      setRotation(index * stepDeg);
    } else {
      const steps = ((index - prev) % order + order) % order;
      setRotation((r) => r + steps * stepDeg);
    }
    prevIndexRef.current = index;
  }, [index, order, stepDeg]);

  return rotation;
}

// Remembers the last non-null value seen - used for the Suit Cycle HUD's
// lead-marker ring, which must keep highlighting the Invoker's last real
// seat while indeterminate (nobody's about to lead / lead suit not yet
// known) rather than losing its position, even though the badges'
// rotation freezes for the exact same reason via useForwardRotation's own
// null-handling.
function useLastKnown<T>(value: T | null): T | null {
  const ref = useRef<T | null>(value);
  useEffect(() => {
    if (value !== null) ref.current = value;
  }, [value]);
  return value !== null ? value : ref.current;
}

// Layout constants matching ui/renderGameView.ts's real seat/cluster
// geometry by value (CENTER_X, CLUSTER_CENTER_Y) so this DOM chrome lines
// up with the still-canvas-drawn play areas/hand fan beneath it - the
// design's own mockup used different, only approximate guide-box
// coordinates for the same regions (it was built independently of this
// codebase's actual Stage 3a layout), so positions here were adapted to
// the real scene rather than copied verbatim; only each element's own
// visual styling is a direct pixel-for-pixel port.
const WIDTH = 390;
const CENTER_X = WIDTH / 2;
// Kept in sync with ui/renderGameView.ts's matching constants (grown/
// respaced for the card-frame compositing task's taller cards - see
// BUILD_STATUS.md).
const CLUSTER_CENTER_Y = 305;
const TOP_TAG_TOP = 50;
const SIDE_TAG_TOP = 358;
const BOTTOM_TAG_TOP = 501;
// Height of the local ("P3 (You)") name tag box (padding:1 x2 + its
// minHeight:46 inner) - used to sit the Team HUD flush against its
// bottom edge with zero gap, per the design's own attached placement.
const LOCAL_TAG_HEIGHT = 48;
// Extra room reserved when the local seat is also this trick's starter,
// so the Team HUD sits below the "Invoker" tag too rather than
// overlapping it (gap:6 + the tag's own ~3px/11px padding + text).
const LOCAL_INVOKER_TAG_HEIGHT = 28;
// Shared bottom anchor for the three-part bottom row (Set / Action / Log) -
// see BUILD_STATUS.md for why these three, previously scattered (one of
// them canvas-drawn), are now one coordinated DOM row.
const BOTTOM_ROW_BOTTOM = 54;
// The Required Suit banner sits between the player cluster and the hand
// fan - the player-facing prompt for what must be followed this trick, per
// this task's board requirements (it does not duplicate the suit symbol
// already shown by the Suit Cycle HUD ring above it - this is the only
// spot that also names the suit in text).
const REQUIRED_SUIT_BANNER_TOP = 590;
// Center HUD geometry (asset-based replacement of the old procedural
// rotating-rings HUD - see BUILD_STATUS.md). One carved-stone bezel
// (ui_suit_cycle_bezel.png, four circular recesses + open center) plus one
// rotating pointer (ui_current_turn_pointer.png). The bezel itself
// rotates as one rigid unit so the current lead suit's baked-in recess
// lands at the actual seat of whoever led the trick (by explicit user
// override - see BUILD_STATUS.md) - there's no way to move the four
// recesses independently any more since they're baked into one texture,
// unlike the old ring's separate per-badge DOM elements. Each Deity symbol
// (and the Lead label/glow) is a separate overlay that counter-rotates by
// the bezel's inverse angle so it stays upright regardless of bezel angle
// - confirmed via pixel analysis that the bezel art itself has genuine
// 4-fold rotational symmetry (no unique orientation marking), so this is
// safe.
const HUD_SIZE = 168;
// Each recess's center, as a fraction of HUD_SIZE from the bezel's own
// center - measured directly off ui_suit_cycle_bezel.png's real pixels
// (all four recesses land within ~0.004 of this fraction on both axes),
// not estimated from the design description. Index 0 (local top) is the
// home position for SUITS[0]/Yog-Sothoth, matching the same top/right/
// bottom/left seat geometry SEAT_ORDER/SEAT_DEG use.
const RECESS_OFFSET_FRACTION = 0.3;
const RECESS_SYMBOL_SIZE = HUD_SIZE * 0.24;
const RECESS_GLOW_SIZE = HUD_SIZE * 0.34;
// The pointer PNG's own tip sits ~0.946 of its half-height from the
// image's center (long needle, short blunt counterweight) - sized here so
// the tip reaches just inside the recess ring rather than overshooting
// past the bezel's outer edge.
const POINTER_SIZE = HUD_SIZE * 0.58;

// Indexed 0-3, matching SUITS/GOD_TO_SUIT_INDEX's fixed order (Yog-Sothoth
// top, Cthulhu right, Shub-Niggurath bottom, Nyarlathotep left).
const RECESS_OFFSET: readonly { dx: number; dy: number }[] = [
  { dx: 0, dy: -HUD_SIZE * RECESS_OFFSET_FRACTION },
  { dx: HUD_SIZE * RECESS_OFFSET_FRACTION, dy: 0 },
  { dx: 0, dy: HUD_SIZE * RECESS_OFFSET_FRACTION },
  { dx: -HUD_SIZE * RECESS_OFFSET_FRACTION, dy: 0 },
];

// Canonical per-Deity accent hue for the Lead recess glow - a neutral-
// white core (shared, see the glow itself below) plus this hue, per the
// approved spec: Cthulhu cyan, Nyarlathotep purple, Shub-Niggurath green,
// Yog-Sothoth gold (gold value matches the existing gold accent already
// used elsewhere in this file, e.g. the local seat tag's border).
const GOD_ACCENT_RGB: Record<God, string> = {
  Cthulhu: '90, 224, 210',
  Nyarlathotep: '176, 120, 232',
  ShubNiggurath: '120, 200, 110',
  YogSothoth: '198, 160, 78',
};

export function GameOverlay({
  sortLabel,
  onToggleSort,
  actionLabel,
  actionHint,
  actionEnabled,
  onAction,
  onOpenRedistLog,
  onOpenMenu,
  seatDelegate,
  seatLabels,
  currentTurnSeat,
  starterSeat,
  leadGodIndex,
  teamName,
  yourGodChip,
  teammateGodChip,
  requiredSuitGod,
}: GameOverlayProps): JSX.Element {
  const turnSeatIndex = currentTurnSeat === null ? null : SEAT_ORDER.indexOf(currentTurnSeat);
  const turnDeg = useForwardRotation(turnSeatIndex, 4, 90);

  // Bezel rotation, now seat-relative (by explicit user override - see
  // BUILD_STATUS.md - of the immediately prior task's fixed-top-marker
  // design). The HUD sits at the center of the four seat tags around it
  // (SEAT_ORDER's own top/right/bottom/left), so its four cardinal
  // recess positions read as those same four seats, not an abstract
  // fixed marker - the lit recess should sit in the direction of
  // whoever actually led the trick, so a glance at the HUD alone shows
  // both *what* suit leads and *who* led it. Recesses are laid out
  // (RECESS_OFFSET below) with SUITS[0]/Yog-Sothoth at local top going
  // clockwise, i.e. recess `i`'s home screen angle is `i * 90`; we want
  // that angle to land on `SEAT_DEG[starterSeat]` once rotated, so
  // `suitIndex = starterIndex - leadGodIndex` (mod 4) is the number of
  // forward 90deg steps needed - ported from the pre-Center-HUD-redesign
  // ring's own "Invoker's actual seat" fix (see git history), adapted to
  // this rigid single-bezel-rotation mechanism. Indeterminate whenever
  // either half is unknown (between tricks, or before any trick has ever
  // had a real leader) - `useForwardRotation`'s existing forward-only,
  // freeze-on-null, never-snap-back stepping (already used by the turn
  // pointer above) freezes the bezel at its last real position rather
  // than losing it, same as before.
  const starterIndex = starterSeat === null ? null : SEAT_DEG[starterSeat] / 90;
  const suitIndex = starterIndex === null || leadGodIndex === null ? null : (((starterIndex - leadGodIndex) % 4) + 4) % 4;
  const suitDeg = useForwardRotation(suitIndex, 4, 90);

  // Which recess sits at the leader's own seat once rotation settles - by
  // construction this is always `leadGodIndex` itself, frozen at its last
  // real value while indeterminate (between tricks, or before any trick
  // has ever had a real leader yet) rather than losing its position -
  // same freeze spirit as `suitDeg` above. Still drives the Lead glow +
  // LEAD label, kept from a prior task per explicit user request
  // (rotation and the glow/label are additive, not alternatives).
  const litGodIndex = useLastKnown(leadGodIndex) ?? 0;
  const teamHudTop = BOTTOM_TAG_TOP + LOCAL_TAG_HEIGHT + (starterSeat === 'bottom' ? LOCAL_INVOKER_TAG_HEIGHT : 0);

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {/* ===== Center HUD (rotating bezel + rotating pointer) =====
          Replaces the old two-tier procedural rotating-rings HUD
          (outer turn-indicator bezel + inner suit-cycle inlay) entirely
          with the approved art assets - see BUILD_STATUS.md. The bezel
          image rotates as one rigid unit - since its four recesses are
          baked into a single texture, unlike the old ring's separate
          per-badge DOM elements, there's no way to move a recess
          independently any more - so each Deity symbol (and the Lead
          glow/label) counter-rotates by the bezel's inverse angle to
          stay upright. Rotation targets the actual seat of whoever led
          the trick (`suitDeg`, seat-relative - see its own comment
          above), not a fixed screen position, by explicit user override.
          The pointer is unaffected and keeps rotating independently
          toward `currentTurnSeat`. Back-to-front: 1) the rotating bezel,
          2) the four counter-rotating symbols (+ Lead glow/label on
          whichever one is currently at the leader's seat), 3) the
          pointer. */}
      <div
        data-ui="center-hud"
        style={{ position: 'absolute', left: CENTER_X, top: CLUSTER_CENTER_Y, width: HUD_SIZE, height: HUD_SIZE, marginLeft: -HUD_SIZE / 2, marginTop: -HUD_SIZE / 2, pointerEvents: 'none' }}
      >
        {/* 1. Rotating bezel group - the bezel image plus all four recess
            anchors rotate together as one rigid unit (`suitDeg`), so the
            current lead suit's baked-in recess lands at the trick
            leader's actual seat (top/right/bottom/left). */}
        <div
          data-ui="suit-cycle-bezel-group"
          style={{
            position: 'absolute',
            inset: 0,
            transition: `transform ${tune.suitCycleRotationMs}ms ${tune.suitCycleRotationEasing}`,
            transform: `rotate(${suitDeg}deg)`,
          }}
        >
          <img src={suitCycleBezelUrl()} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

          {/* The four Deity symbols, one per recess anchor - each anchor
              moves rigidly with the bezel group above, but its inner
              content counter-rotates by `-suitDeg` so the symbol (and the
              Lead glow/label, when lit) stays visually upright regardless
              of the bezel's current rotation angle. Never redrawn/
              cropped/baked into the bezel itself. */}
          {SUITS.map((suit, i) => {
            const motif = GOD_MOTIF[suit.god];
            const offset = RECESS_OFFSET[i];
            const isLit = i === litGodIndex;
            const accent = GOD_ACCENT_RGB[suit.god];
            return (
              <div
                key={suit.code}
                data-suit={suit.code}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: RECESS_SYMBOL_SIZE,
                  height: RECESS_SYMBOL_SIZE,
                  transform: `translate(calc(-50% + ${offset.dx}px), calc(-50% + ${offset.dy}px))`,
                }}
              >
                <div
                  data-ui="suit-cycle-counter-rotate"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    transition: `transform ${tune.suitCycleRotationMs}ms ${tune.suitCycleRotationEasing}`,
                    transform: `rotate(${-suitDeg}deg)`,
                  }}
                >
                  {/* Lead glow - one shared radius/intensity/pulse timing/
                      easing across all four Deities, neutral-white core
                      fading into this Deity's canonical accent hue. Placed
                      behind the symbol (not literally "on top" per a
                      strict reading of the back-to-front list) since a
                      glow the same size as the icon it covers would
                      defeat the "visible clearance" requirement below. */}
                  {isLit && (
                    <div
                      data-ui="lead-glow"
                      style={{
                        position: 'absolute',
                        left: '50%',
                        top: '50%',
                        width: RECESS_GLOW_SIZE,
                        height: RECESS_GLOW_SIZE,
                        marginLeft: -RECESS_GLOW_SIZE / 2,
                        marginTop: -RECESS_GLOW_SIZE / 2,
                        borderRadius: '50%',
                        background: `radial-gradient(circle, rgba(255, 255, 255, 0.55) 0%, rgba(${accent}, 0.45) 45%, rgba(${accent}, 0) 75%)`,
                        animation: `suitsMpLeadGlowPulse ${tune.leadGlowPulseMs}ms ${tune.leadGlowPulseEasing} infinite`,
                      }}
                    />
                  )}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      borderRadius: motif === 'circle' ? '50%' : 0,
                      clipPath: motif === 'hex' ? HEX_CLIP_PATH : undefined,
                    }}
                  >
                    <img src={symbolArtUrl(suit.god)} alt={suit.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  </div>
                  {/* LEAD label - topmost within this recess's own
                      counter-rotating group, so it stays upright alongside
                      the symbol it labels. `Lead Suit` remains the
                      canonical gameplay term; this is only the compact HUD
                      label - not a standalone Lead Player badge, which
                      stays deliberately absent from this screen. */}
                  {isLit && (
                    <div
                      data-ui="lead-label"
                      style={{
                        position: 'absolute',
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        fontFamily: "'Cormorant Unicase', serif",
                        fontWeight: 700,
                        fontSize: 9,
                        letterSpacing: '0.14em',
                        color: 'oklch(0.96 0.02 90)',
                        textShadow: '0 0 6px rgba(0, 0, 0, 0.9), 0 0 3px rgba(0, 0, 0, 0.9)',
                      }}
                    >
                      LEAD
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 2. Rotating current-turn pointer - pivot at the exact
            geometric center of the HUD, sprite origin at the center of
            its own square asset (per the handoff, so no off-center pivot
            math is needed), rotated via the same forward-rotation
            behavior as before (`turnDeg`, untouched). Deliberately NOT
            inside the bezel group above - its rotation tracks
            `currentTurnSeat` independently and must never be coupled to
            the bezel's `suitDeg`. Never tinted by Deity or team - it's
            neutral carved pewter regardless of state. */}
        <img
          data-bind="turn-rotation"
          src={currentTurnPointerUrl()}
          alt=""
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: POINTER_SIZE,
            height: POINTER_SIZE,
            marginLeft: -POINTER_SIZE / 2,
            marginTop: -POINTER_SIZE / 2,
            transition: `transform ${tune.turnWheelRotationMs}ms ${tune.turnWheelRotationEasing}`,
            transform: `rotate(${turnDeg}deg)`,
          }}
        />
      </div>

      {/* ===== Player name displays + Trick Starter tags ===== */}
      {SEAT_ORDER.map((seat) => {
        const isStarter = seat === starterSeat;
        const isLocal = seat === 'bottom';
        const delegate = seatDelegate[seat];
        const tagTop = seat === 'top' ? TOP_TAG_TOP : seat === 'bottom' ? BOTTOM_TAG_TOP : SIDE_TAG_TOP;
        const width = isLocal ? 208 : seat === 'top' ? 120 : 94;
        const horizontal: CSSProperties =
          seat === 'left' ? { left: 10 } : seat === 'right' ? { right: 10 } : { left: CENTER_X - width / 2 };

        return (
          <div key={seat} data-ui="seat" data-seat={seat} style={{ position: 'absolute', top: tagTop, width, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: isLocal ? 6 : 5, ...horizontal }}>
            {isLocal ? (
              <div
                style={{
                  width: '100%',
                  padding: 1,
                  boxSizing: 'border-box',
                  background: 'linear-gradient(180deg, rgba(212, 174, 88, 0.75), rgba(120, 92, 34, 0.5))',
                  clipPath: 'polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px), 0 10px)',
                  boxShadow: '0 0 30px rgba(196, 156, 66, 0.3)',
                }}
              >
                <div
                  style={{
                    minHeight: 46,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 11,
                    // Real ui_player_nameplate.png applied here only - the
                    // local seat is never a delegate-selection target (a
                    // player can't delegate to themself), so there's no
                    // staged/not-staged color cue to lose. The other three
                    // seat tags below keep their teal/gold gradient
                    // treatment, which does carry that state - see
                    // BUILD_STATUS.md.
                    background: `linear-gradient(180deg, rgba(20, 16, 8, 0.15), rgba(4, 4, 3, 0.3)), url(${nameplateUrl()}) center/100% 100% no-repeat`,
                    clipPath: 'polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px), 0 10px)',
                  }}
                >
                  <span style={{ color: 'oklch(0.84 0.11 84)', fontSize: 11, textShadow: '0 0 12px rgba(226, 182, 84, 0.8)' }}>✦</span>
                  <span data-bind="player-name" style={{ fontFamily: "'IM Fell English SC', serif", fontSize: 20, letterSpacing: '0.03em', color: 'oklch(0.95 0.04 90)' }}>
                    {seatLabels[seat]}
                  </span>
                  <span
                    style={{
                      fontFamily: "'Cormorant Unicase', serif",
                      fontWeight: 500,
                      fontSize: 9,
                      letterSpacing: '0.2em',
                      color: 'rgba(228, 196, 128, 0.7)',
                      borderLeft: '1px solid rgba(198, 160, 78, 0.4)',
                      paddingLeft: 10,
                    }}
                  >
                    Thee
                  </span>
                </div>
              </div>
            ) : (
              <button
                type="button"
                data-ui="seat-tag"
                data-tappable={delegate.tappable}
                onClick={delegate.tappable ? delegate.onPick : undefined}
                disabled={!delegate.tappable}
                style={{
                  width: '100%',
                  minHeight: 34,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: seat === 'top' ? 7 : 6,
                  padding: seat === 'top' ? '0 10px' : '0 7px',
                  boxSizing: 'border-box',
                  border: '0',
                  borderTop: `1px solid ${delegate.staged ? 'rgba(198, 160, 78, 0.55)' : 'rgba(120, 190, 178, 0.3)'}`,
                  borderBottom: `1px solid ${delegate.staged ? 'rgba(198, 160, 78, 0.55)' : 'rgba(120, 190, 178, 0.3)'}`,
                  background: delegate.staged
                    ? 'linear-gradient(180deg, rgba(48, 36, 12, 0.86), rgba(20, 14, 5, 0.88))'
                    : 'linear-gradient(180deg, rgba(10, 34, 36, 0.86), rgba(5, 14, 17, 0.88))',
                  cursor: delegate.tappable ? 'pointer' : 'default',
                  font: 'inherit',
                  // The root overlay wrapper is deliberately click-through
                  // (`pointerEvents: 'none'` at this file's own top) so
                  // ordinary board/canvas taps reach the canvas beneath it -
                  // every other real interactive element here (Sort/Action/
                  // Menu/Redist-Log buttons) explicitly opts back in with its
                  // own `pointerEvents: 'auto'`. This button never did, so it
                  // inherited `none` and was genuinely unclickable by any
                  // real pointer event even while `data-tappable`/`disabled`
                  // correctly reported it as ready - confirmed live via
                  // `document.elementFromPoint` at the button's own center
                  // resolving to the canvas, not this element. Scoped to
                  // `delegate.tappable` (rather than always 'auto') so a
                  // non-tappable seat tag - true prior to the actual
                  // selectDelegate phase, i.e. the game's usual state - still
                  // lets ordinary board taps in that area reach the canvas
                  // underneath, exactly as before this fix.
                  pointerEvents: delegate.tappable ? 'auto' : 'none',
                }}
              >
                <span style={{ color: 'rgba(120, 200, 186, 0.7)', fontSize: 9 }}>◆</span>
                <span
                  data-bind="player-name"
                  style={{
                    fontFamily: "'IM Fell English SC', serif",
                    fontSize: seat === 'top' ? 15 : 14,
                    letterSpacing: '0.02em',
                    color: 'oklch(0.90 0.02 100)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    minWidth: 0,
                  }}
                >
                  {seatLabels[seat]}
                </span>
              </button>
            )}
            {isStarter && (
              <div
                data-ui="trick-starter-tag"
                style={{
                  padding: isLocal ? '3px 11px' : '2px 10px',
                  border: `1px solid rgba(198, 160, 78, ${isLocal ? 0.6 : 0.55})`,
                  background: `rgba(48, 36, 12, ${isLocal ? 0.65 : 0.6})`,
                  fontFamily: "'Cormorant Unicase', serif",
                  fontWeight: 700,
                  fontSize: isLocal ? 10 : 9,
                  letterSpacing: '0.16em',
                  color: `oklch(${isLocal ? 0.87 : 0.85} 0.09 84)`,
                }}
              >
                Lead Player
              </div>
            )}
          </div>
        );
      })}

      {/* ===== Team / god identity HUD ===== */}
      {/* Reduced to 50% size and sat flush against the local name tag's
          bottom edge (zero gap) - a plain CSS scale on a wrapper sized/
          positioned exactly as the original box keeps every inner value
          (borders, shadows, chip sizes, fonts) uniformly halved rather
          than needing every px value hand-edited. transformOrigin 'top
          center' keeps it centered on CENTER_X and anchored to teamHudTop
          (its own top edge doesn't move under the scale). */}
      <div style={{ position: 'absolute', left: CENTER_X - 136, top: teamHudTop, width: 272, transform: 'scale(0.5)', transformOrigin: 'top center' }}>
        <div
          data-ui="team-hud"
          style={{
            minHeight: 50,
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 13px',
            borderTop: '1px solid rgba(160, 120, 210, 0.3)',
            borderBottom: '1px solid rgba(160, 120, 210, 0.3)',
            background: 'linear-gradient(180deg, rgba(24, 18, 40, 0.9), rgba(9, 9, 16, 0.93))',
            boxShadow: 'inset 0 0 34px rgba(104, 58, 168, 0.24)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontFamily: "'Cormorant Unicase', serif", fontWeight: 500, fontSize: 8, letterSpacing: '0.2em', color: 'rgba(196, 178, 224, 0.6)' }}>Thy covenant</span>
            <span data-bind="team-name" style={{ fontFamily: "'IM Fell English SC', serif", fontSize: 18, lineHeight: 1.05, color: 'oklch(0.88 0.09 88)' }}>
              {teamName}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div
              data-ui="god-chip"
              data-god={yourGodChip.code}
              data-assigned="true"
              style={{
                width: 52,
                height: 36,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid oklch(0.80 0.11 84)',
                background: 'linear-gradient(180deg, rgba(92, 70, 20, 0.92), rgba(42, 32, 10, 0.92))',
                boxShadow: '0 0 18px rgba(204, 162, 62, 0.42), inset 0 0 10px rgba(0,0,0,0.6)',
                clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
              }}
            >
              {yourGodChip.god && <img src={symbolArtUrl(yourGodChip.god)} alt={yourGodChip.code} style={{ width: 18, height: 18, objectFit: 'contain' }} />}
              <span style={{ fontFamily: "'Cormorant Unicase', serif", fontWeight: 500, fontSize: 7, letterSpacing: '0.12em', color: 'rgba(252, 226, 164, 0.75)' }}>{yourGodChip.label}</span>
            </div>
            <div
              data-ui="god-chip"
              data-god={teammateGodChip.code}
              data-assigned="false"
              style={{
                width: 52,
                height: 36,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px dashed rgba(190, 172, 222, 0.3)',
                background: 'rgba(20, 18, 32, 0.75)',
                clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
              }}
            >
              {teammateGodChip.god && (
                <img src={symbolArtUrl(teammateGodChip.god)} alt={teammateGodChip.code} style={{ width: 18, height: 18, objectFit: 'contain', opacity: 0.7 }} />
              )}
              <span style={{ fontFamily: "'Cormorant Unicase', serif", fontWeight: 500, fontSize: 7, letterSpacing: '0.12em', color: 'rgba(186, 174, 212, 0.45)' }}>{teammateGodChip.label}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Required Suit banner - real ===== */}
      <div
        data-ui="required-suit-banner"
        style={{
          position: 'absolute',
          left: 14,
          right: 14,
          top: REQUIRED_SUIT_BANNER_TOP,
          height: 34,
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 12px',
          background: 'linear-gradient(180deg, rgba(10, 34, 36, 0.82), rgba(5, 14, 17, 0.86))',
          border: '1px solid rgba(120, 190, 178, 0.28)',
        }}
      >
        {requiredSuitGod ? (
          <span
            style={{
              width: 18,
              height: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              borderRadius: GOD_MOTIF[requiredSuitGod] === 'circle' ? '50%' : 0,
              clipPath: GOD_MOTIF[requiredSuitGod] === 'hex' ? HEX_CLIP_PATH : undefined,
            }}
          >
            <img src={symbolArtUrl(requiredSuitGod)} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </span>
        ) : null}
        <span
          style={{
            fontFamily: "'Cormorant Unicase', serif",
            fontWeight: 500,
            fontSize: 9,
            letterSpacing: '0.16em',
            color: 'rgba(158, 196, 186, 0.6)',
          }}
        >
          Required Suit
        </span>
        <span
          style={{
            fontFamily: "'IM Fell English SC', serif",
            fontSize: 15,
            color: 'oklch(0.86 0.09 178)',
          }}
        >
          {requiredSuitGod ? GOD_DISPLAY_NAME[requiredSuitGod] : 'Any Suit'}
        </span>
      </div>

      {/* ===== Top-left: Menu - real =====
          New hub (dom/MenuModal.tsx) hosting Rules and the previous-trick
          log, replacing the old canvas-drawn top-bar Rules/Log buttons -
          see ui/renderGameView.ts's renderTopBar. Square, carved black-
          and-gold family matching the Play Card action button (per the
          approved preview), via the real ui_action_slab.png art. */}
      <button
        type="button"
        data-ui="menu-button"
        onClick={onOpenMenu}
        style={{
          position: 'absolute',
          left: 10,
          top: 18,
          width: 52,
          height: 52,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          // Procedural inset-stone treatment, not ui_action_slab.png: that
          // asset is a wide bar (see BUILD_STATUS.md for its real aspect
          // ratio) and stretching it into a square distorted it into a
          // washed-out flat-gold box rather than a carved control. No
          // dedicated square-button asset exists for Menu/Set/Log.
          background:
            'linear-gradient(180deg, rgba(30, 28, 24, 0.95), rgba(10, 9, 8, 0.97)), radial-gradient(120% 120% at 30% 18%, rgba(255, 255, 255, 0.05), rgba(0, 0, 0, 0) 55%)',
          boxShadow: 'inset 0 2px 5px rgba(0, 0, 0, 0.65), inset 0 -1px 0 rgba(198, 160, 78, 0.14)',
          border: '1px solid rgba(198, 160, 78, 0.55)',
          color: 'oklch(0.86 0.09 84)',
          fontFamily: "'Cormorant Unicase', serif",
          fontWeight: 500,
          fontSize: 10,
          letterSpacing: '0.1em',
          cursor: 'pointer',
          pointerEvents: 'auto',
        }}
      >
        <span style={{ fontSize: 15, lineHeight: 1 }}>☰</span>
        Menu
      </button>

      {/* ===== Bottom row, left: hand sort ("Set") - real ===== */}
      <button
        type="button"
        data-ui="sort-cards-button"
        onClick={onToggleSort}
        style={{
          position: 'absolute',
          left: 10,
          bottom: BOTTOM_ROW_BOTTOM,
          width: 52,
          height: 52,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          // Procedural inset-stone treatment, not ui_action_slab.png: that
          // asset is a wide bar (see BUILD_STATUS.md for its real aspect
          // ratio) and stretching it into a square distorted it into a
          // washed-out flat-gold box rather than a carved control. No
          // dedicated square-button asset exists for Menu/Set/Log.
          background:
            'linear-gradient(180deg, rgba(30, 28, 24, 0.95), rgba(10, 9, 8, 0.97)), radial-gradient(120% 120% at 30% 18%, rgba(255, 255, 255, 0.05), rgba(0, 0, 0, 0) 55%)',
          boxShadow: 'inset 0 2px 5px rgba(0, 0, 0, 0.65), inset 0 -1px 0 rgba(198, 160, 78, 0.14)',
          border: '1px solid rgba(198, 160, 78, 0.55)',
          color: 'oklch(0.86 0.09 84)',
          fontFamily: "'Cormorant Unicase', serif",
          fontWeight: 500,
          fontSize: 10,
          letterSpacing: '0.1em',
          cursor: 'pointer',
          pointerEvents: 'auto',
        }}
        aria-label={sortLabel}
      >
        <span style={{ fontSize: 15, lineHeight: 1 }}>⌘</span>
        Set
      </button>

      {/* ===== Bottom row, right: Redistribution log ("Log") - real ===== */}
      <button
        type="button"
        data-ui="redist-log-button"
        onClick={onOpenRedistLog}
        style={{
          position: 'absolute',
          right: 10,
          bottom: BOTTOM_ROW_BOTTOM,
          width: 52,
          height: 52,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          // Procedural inset-stone treatment, not ui_action_slab.png: that
          // asset is a wide bar (see BUILD_STATUS.md for its real aspect
          // ratio) and stretching it into a square distorted it into a
          // washed-out flat-gold box rather than a carved control. No
          // dedicated square-button asset exists for Menu/Set/Log.
          background:
            'linear-gradient(180deg, rgba(30, 28, 24, 0.95), rgba(10, 9, 8, 0.97)), radial-gradient(120% 120% at 30% 18%, rgba(255, 255, 255, 0.05), rgba(0, 0, 0, 0) 55%)',
          boxShadow: 'inset 0 2px 5px rgba(0, 0, 0, 0.65), inset 0 -1px 0 rgba(198, 160, 78, 0.14)',
          border: '1px solid rgba(198, 160, 78, 0.55)',
          color: 'oklch(0.86 0.09 84)',
          fontFamily: "'Cormorant Unicase', serif",
          fontWeight: 500,
          fontSize: 10,
          letterSpacing: '0.1em',
          cursor: 'pointer',
          pointerEvents: 'auto',
        }}
      >
        <span style={{ fontSize: 15, lineHeight: 1 }}>☷</span>
        Log
      </button>

      {/* ===== Bottom row, center: Action button - real ===== */}
      <button
        type="button"
        data-ui="action-button"
        data-enabled={actionEnabled}
        onClick={actionEnabled ? onAction : undefined}
        disabled={!actionEnabled}
        style={{
          position: 'absolute',
          left: CENTER_X - 77,
          bottom: BOTTOM_ROW_BOTTOM,
          width: 154,
          padding: 1,
          boxSizing: 'border-box',
          border: 0,
          background: actionEnabled ? 'linear-gradient(180deg, rgba(226, 188, 96, 0.9), rgba(120, 88, 30, 0.6))' : 'rgba(90, 104, 104, 0.22)',
          clipPath: 'polygon(11px 0, calc(100% - 11px) 0, 100% 11px, 100% calc(100% - 11px), calc(100% - 11px) 100%, 11px 100%, 0 calc(100% - 11px), 0 11px)',
          boxShadow: actionEnabled ? '0 0 40px rgba(212, 168, 66, 0.42)' : 'none',
          cursor: actionEnabled ? 'pointer' : 'not-allowed',
          pointerEvents: 'auto',
        }}
      >
        <span
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            height: 56,
            background: actionEnabled
              ? 'linear-gradient(180deg, rgba(106, 78, 22, 0.96), rgba(38, 28, 10, 0.97))'
              : 'linear-gradient(180deg, rgba(16, 24, 26, 0.9), rgba(8, 12, 14, 0.92))',
            clipPath: 'polygon(11px 0, calc(100% - 11px) 0, 100% 11px, 100% calc(100% - 11px), calc(100% - 11px) 100%, 11px 100%, 0 calc(100% - 11px), 0 11px)',
          }}
        >
          <span
            style={{
              fontFamily: "'IM Fell English SC', serif",
              fontSize: 21,
              letterSpacing: '0.06em',
              color: actionEnabled ? 'oklch(0.97 0.04 92)' : 'rgba(150, 176, 174, 0.4)',
              textShadow: actionEnabled ? '0 0 16px rgba(252, 216, 130, 0.6)' : 'none',
            }}
          >
            {actionLabel}
          </span>
          <span
            data-bind="action-hint"
            style={{
              fontFamily: "'Cormorant Unicase', serif",
              fontWeight: 500,
              fontSize: 8,
              letterSpacing: '0.18em',
              color: actionEnabled ? 'rgba(252, 228, 170, 0.7)' : 'rgba(150, 176, 174, 0.32)',
            }}
          >
            {actionHint}
          </span>
        </span>
      </button>
    </div>
  );
}
