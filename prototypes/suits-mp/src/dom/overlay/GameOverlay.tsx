import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import './GameOverlay.css';
import { SEAT_DEG, SEAT_ORDER, SUITS } from './overlayContent';
import type { GodChipState, SeatDelegateState } from './gameOverlayStore';
import type { SeatPosition } from '../../ui/seating';
import { GOD_MOTIF } from '../../rules/godArt';
import { GOD_DISPLAY_NAME } from '../../rules/cards';
import type { God } from '../../rules/types';
import { HEX_CLIP_PATH, nameplateUrl, symbolArtUrl } from '../godArtUrl';
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
// Centre inlay geometry (visual reskin pass - see BUILD_STATUS.md). Wells
// are positioned by a single center-relative offset (WELL_OFFSET) rather
// than edge-anchored to the housing's own border, so they read as
// tightly grouped near the middle of the carved-stone inlay per the
// approved preview, instead of pinned to its outer rim.
const OUTER_BEZEL_SIZE = 168;
const INLAY_SIZE = 150;
const WELL_SIZE = 42;
const WELL_OFFSET = 30;
const MARKER_SIZE = 50;

// Suit Cycle HUD's lead-marker ring: pixel offset from the inlay's own
// center for each seat it might need to highlight - matches WELL_OFFSET
// exactly, since the marker must frame whichever well currently sits at
// that position.
const MARKER_OFFSET: Record<SeatPosition, { dx: number; dy: number }> = {
  top: { dx: 0, dy: -WELL_OFFSET },
  right: { dx: WELL_OFFSET, dy: 0 },
  bottom: { dx: 0, dy: WELL_OFFSET },
  left: { dx: -WELL_OFFSET, dy: 0 },
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

  // The wheel must land the *current lead suit's* badge exactly at the
  // Invoker's actual seat position (top/right/bottom/left) - wherever
  // that is, not a fixed anchor (that was the previous bug: it assumed
  // the Invoker was always at the bottom, which only happened to be true
  // when the local player was leading). Each suit has a fixed home angle
  // on the ring (badges are laid out with Yog-Sothoth/SUITS[0] at local
  // top, going clockwise - `leadGodIndex * 90`), and `starterSeat` is the
  // Invoker's real seat (ui/seating.ts's computeSuitRing already resolves
  // this correctly for both this-session-live triggers: the local
  // player's own live pre-commit preview via `previewCardId`, when
  // *they're* the Invoker, and the host's confirmed `state.leadSuit` once
  // any other player's leading play is broadcast - never a guess at
  // another player's hidden selection). `SEAT_DEG` (below) is the same
  // seat->angle mapping the turn-indicator wheel's own `turnSeatIndex`
  // already encodes (via SEAT_ORDER's clockwise order); reused here
  // rather than re-derived, per the seat/angle correspondence the wheel
  // already gets right.
  //
  // Required rotation = angle_of(Invoker's seat) - home_angle_of(lead
  // suit), reduced to a 0-3 step index so useForwardRotation's existing
  // forward-only, freeze-on-null, never-snap-back stepping (the same
  // behavior the turn wheel and the old suit ring both already relied on)
  // still applies - only *what* index that stepping follows changed.
  const starterIndex = starterSeat === null ? null : SEAT_DEG[starterSeat] / 90;
  const suitIndex = starterIndex === null || leadGodIndex === null ? null : (((starterIndex - leadGodIndex) % 4) + 4) % 4;
  const suitDeg = useForwardRotation(suitIndex, 4, 90);

  // The lead-marker ring (below) highlights whichever badge is currently
  // at the Invoker's seat - it has to track `starterSeat` directly now
  // that the Invoker isn't always at the bottom, freezing at the last
  // real seat (rather than losing its position) the same way the ring's
  // own rotation freezes on indeterminate state. Defaults to 'bottom'
  // only before any trick has ever had a real leader yet (game start).
  const markerSeat = useLastKnown(starterSeat) ?? 'bottom';
  const teamHudTop = BOTTOM_TAG_TOP + LOCAL_TAG_HEIGHT + (starterSeat === 'bottom' ? LOCAL_INVOKER_TAG_HEIGHT : 0);

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {/* ===== Turn indicator wheel (outer bezel, independent layer) =====
          Visual reskin only (see BUILD_STATUS.md) - a single carved-stone
          bezel ring replaces the old multi-ring glowing/dotted/spinning-
          sigil stack. `turnDeg` (computed above, untouched) still drives
          the exact same rotating pointer; only its container's styling
          changed. */}
      <div
        data-ui="turn-indicator-wheel"
        style={{
          position: 'absolute',
          left: CENTER_X,
          top: CLUSTER_CENTER_Y,
          width: OUTER_BEZEL_SIZE,
          height: OUTER_BEZEL_SIZE,
          marginLeft: -OUTER_BEZEL_SIZE / 2,
          marginTop: -OUTER_BEZEL_SIZE / 2,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 40% 32%, rgba(72, 68, 60, 0.28), rgba(10, 10, 11, 0) 68%)',
            boxShadow: 'inset 0 3px 7px rgba(0, 0, 0, 0.65), inset 0 -2px 5px rgba(120, 100, 60, 0.12)',
          }}
        />
        <div
          data-bind="turn-rotation"
          style={{
            position: 'absolute',
            inset: 0,
            transition: `transform ${tune.turnWheelRotationMs}ms ${tune.turnWheelRotationEasing}`,
            transform: `rotate(${turnDeg}deg)`,
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: 2,
              marginLeft: -7,
              width: 14,
              height: 18,
              background: 'linear-gradient(180deg, oklch(0.82 0.10 84), oklch(0.60 0.09 68))',
              clipPath: 'polygon(50% 100%, 0 0, 50% 26%, 100% 0)',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.6)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: 19,
              width: 1,
              height: 20,
              marginLeft: -0.5,
              background: 'linear-gradient(180deg, rgba(198, 160, 78, 0.6), rgba(198, 160, 78, 0))',
            }}
          />
        </div>
      </div>

      {/* ===== Suit Cycle HUD (inner carved-stone inlay, independent
          layer) ===== Visual reskin only - `suitDeg` (untouched) still
          rotates the whole well group, each well still counter-rotates
          its own symbol by `-suitDeg` so it stays upright, and
          `lead-marker` still tracks `markerSeat` via the same
          translate-offset technique as before (now using WELL_OFFSET so
          it frames the enlarged wells exactly). Only sizes/colors/shapes
          changed - no rotation math touched. */}
      <div
        data-ui="suit-cycle-hud"
        style={{ position: 'absolute', left: CENTER_X, top: CLUSTER_CENTER_Y, width: INLAY_SIZE, height: INLAY_SIZE, marginLeft: -INLAY_SIZE / 2, marginTop: -INLAY_SIZE / 2, pointerEvents: 'none' }}
      >
        {/* Round carved-stone inlay housing - depth via inset shadow only,
            no glowing border/outline (the old teal-bordered radial glow
            read as a floating UI panel, not part of the tabletop). */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: 'radial-gradient(58% 58% at 42% 34%, rgba(46, 42, 38, 0.55) 0%, rgba(8, 8, 9, 0.88) 100%)',
            boxShadow: 'inset 0 4px 11px rgba(0, 0, 0, 0.72), inset 0 -2px 6px rgba(90, 74, 40, 0.10)',
          }}
        />

        <div
          data-bind="lead-suit-rotation"
          style={{
            position: 'absolute',
            inset: 0,
            transition: `transform ${tune.suitCycleRotationMs}ms ${tune.suitCycleRotationEasing}`,
            transform: `rotate(${suitDeg}deg)`,
          }}
        >
          {SUITS.map((suit, i) => {
            const isGold = i % 2 === 0; // YS(0), SN(2) gold/Cosmos; CT(1), NY(3) teal/Chaos - matches the design's fixed per-slot palette
            const offset =
              i === 0
                ? { dx: 0, dy: -WELL_OFFSET }
                : i === 1
                  ? { dx: WELL_OFFSET, dy: 0 }
                  : i === 2
                    ? { dx: 0, dy: WELL_OFFSET }
                    : { dx: -WELL_OFFSET, dy: 0 };
            const motif = GOD_MOTIF[suit.god];
            const tint = isGold ? '198, 160, 78' : '96, 190, 178';
            return (
              <div
                key={suit.code}
                data-suit={suit.code}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: WELL_SIZE,
                  height: WELL_SIZE,
                  transform: `translate(calc(-50% + ${offset.dx}px), calc(-50% + ${offset.dy}px))`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  borderRadius: motif === 'circle' ? '50%' : 0,
                  clipPath: motif === 'hex' ? HEX_CLIP_PATH : undefined,
                  // Glassy well: a soft highlight top-left fading into a
                  // dark, faintly team-tinted floor - procedurally drawn,
                  // no dedicated well asset exists (see BUILD_STATUS.md).
                  background: `radial-gradient(circle at 32% 26%, rgba(255, 255, 255, 0.30), rgba(${tint}, 0.24) 45%, rgba(6, 10, 11, 0.94) 100%)`,
                  border: `1px solid rgba(${tint}, 0.55)`,
                  boxShadow: `inset 0 2px 5px rgba(0, 0, 0, 0.55), inset 0 -1px 3px rgba(${tint}, 0.16)`,
                }}
              >
                {/* Counter-rotates by the wheel's own rotation (-suitDeg),
                    composing with the parent's `rotate(${suitDeg}deg)`
                    above to net zero - the symbol stays upright no matter
                    where the wheel points. Shares the wheel's own
                    transition duration/easing so it stays visually locked
                    upright throughout the animation too, not just at rest. */}
                <div
                  style={{
                    width: WELL_SIZE * 0.68,
                    height: WELL_SIZE * 0.68,
                    transition: `transform ${tune.suitCycleRotationMs}ms ${tune.suitCycleRotationEasing}`,
                    transform: `rotate(${-suitDeg}deg)`,
                  }}
                >
                  <img src={symbolArtUrl(suit.god)} alt={suit.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* The center hub is a small plain stone recess - no symbol, no
            text label (the required suit is stated once, by the Required
            Suit banner below, never duplicated here). */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 34,
            height: 34,
            margin: '-17px 0 0 -17px',
            borderRadius: '50%',
            background: 'radial-gradient(circle at 38% 30%, rgba(40, 38, 34, 0.6), rgba(4, 4, 5, 0.92))',
            boxShadow: 'inset 0 2px 5px rgba(0, 0, 0, 0.7)',
          }}
        />

        {/* Highlights whichever well sits at the Invoker's actual seat
            (`markerSeat`) - not a fixed position, since the Invoker can be
            at any of the 4 seats. Positioned via `transform: translate()`
            (a single interpolatable property, unlike swapping between
            left/right/top/bottom which can't cross-animate) from a fixed
            center anchor, so it can transition smoothly - same timing/
            easing as the wheel's own rotation, so it visually travels
            together with the well it's marking. */}
        <div
          data-ui="lead-marker"
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: MARKER_SIZE,
            height: MARKER_SIZE,
            transition: `transform ${tune.suitCycleRotationMs}ms ${tune.suitCycleRotationEasing}`,
            transform: `translate(calc(-50% + ${MARKER_OFFSET[markerSeat].dx}px), calc(-50% + ${MARKER_OFFSET[markerSeat].dy}px))`,
            borderRadius: '50%',
            border: '1px solid rgba(226, 196, 120, 0.55)',
            boxShadow: '0 0 10px rgba(226, 196, 120, 0.28), inset 0 0 8px rgba(226, 196, 120, 0.14)',
            pointerEvents: 'none',
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
