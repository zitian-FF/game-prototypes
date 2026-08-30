import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import './GameOverlay.css';
import { SEAT_DEG, SEAT_ORDER, SUITS } from './overlayContent';
import type { GodChipState, SeatDelegateState } from './gameOverlayStore';
import type { SeatPosition } from '../../ui/seating';
import { GOD_MOTIF } from '../../rules/godArt';
import { HEX_CLIP_PATH, symbolArtUrl } from '../godArtUrl';
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
  seatDelegate: Record<SeatPosition, SeatDelegateState>;
  seatLabels: Record<SeatPosition, string>;
  currentTurnSeat: SeatPosition | null;
  starterSeat: SeatPosition | null;
  leadGodIndex: number | null;
  teamName: string;
  yourGodChip: GodChipState;
  teammateGodChip: GodChipState;
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
// Shared bottom anchor for the three-part bottom row (Redistribution log
// / Action / Sort) - see BUILD_STATUS.md for why these three, previously
// scattered (one of them canvas-drawn), are now one coordinated DOM row.
const BOTTOM_ROW_BOTTOM = 54;
// Suit Cycle HUD's lead-marker ring: pixel offset from the wheel's own
// center for each seat it might need to highlight - derived from the
// ring's fixed 124px box and the marker's own 36px size/-2px overhang
// (e.g. bottom: {left:'50%', bottom:-2, marginLeft:-18} centers the
// marker at (62, 108) against a (62, 62) ring center = (0, +46)).
const MARKER_OFFSET: Record<SeatPosition, { dx: number; dy: number }> = {
  top: { dx: 0, dy: -46 },
  right: { dx: 46, dy: 0 },
  bottom: { dx: 0, dy: 46 },
  left: { dx: -46, dy: 0 },
};

export function GameOverlay({
  sortLabel,
  onToggleSort,
  actionLabel,
  actionHint,
  actionEnabled,
  onAction,
  onOpenRedistLog,
  seatDelegate,
  seatLabels,
  currentTurnSeat,
  starterSeat,
  leadGodIndex,
  teamName,
  yourGodChip,
  teammateGodChip,
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
      {/* ===== Turn indicator wheel (outer, independent layer) ===== */}
      <div
        data-ui="turn-indicator-wheel"
        style={{
          position: 'absolute',
          left: CENTER_X,
          top: CLUSTER_CENTER_Y,
          width: 190,
          height: 190,
          marginLeft: -95,
          marginTop: -95,
          pointerEvents: 'none',
        }}
      >
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1px solid rgba(176, 142, 66, 0.22)', boxShadow: 'inset 0 0 34px rgba(28, 110, 106, 0.22)' }} />
        <div
          style={{
            position: 'absolute',
            inset: 9,
            borderRadius: '50%',
            borderTop: '1px solid rgba(176, 142, 66, 0.34)',
            borderBottom: '1px solid rgba(176, 142, 66, 0.34)',
            borderLeft: '1px solid transparent',
            borderRight: '1px solid transparent',
          }}
        />
        <div style={{ position: 'absolute', inset: 16, borderRadius: '50%', border: '1px dotted rgba(158, 196, 186, 0.2)' }} />
        <div
          data-ui="outer-sigil-ring"
          style={{
            position: 'absolute',
            inset: -14,
            borderRadius: '50%',
            border: '1px solid rgba(158, 196, 186, 0.07)',
            animation: `somCreep ${tune.outerSigilRingSpinMs}ms linear infinite`,
          }}
        >
          <span style={{ position: 'absolute', left: '50%', top: -5, marginLeft: -4, width: 8, height: 8, border: '1px solid rgba(176, 142, 66, 0.4)', transform: 'rotate(45deg)' }} />
          <span style={{ position: 'absolute', left: '50%', bottom: -5, marginLeft: -4, width: 8, height: 8, border: '1px solid rgba(176, 142, 66, 0.4)', transform: 'rotate(45deg)' }} />
          <span style={{ position: 'absolute', top: '50%', left: -5, marginTop: -4, width: 8, height: 8, border: '1px solid rgba(176, 142, 66, 0.4)', transform: 'rotate(45deg)' }} />
          <span style={{ position: 'absolute', top: '50%', right: -5, marginTop: -4, width: 8, height: 8, border: '1px solid rgba(176, 142, 66, 0.4)', transform: 'rotate(45deg)' }} />
        </div>
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
              top: 3,
              marginLeft: -8,
              width: 16,
              height: 20,
              background: 'oklch(0.80 0.11 84)',
              clipPath: 'polygon(50% 100%, 0 0, 50% 26%, 100% 0)',
              boxShadow: '0 0 20px 4px rgba(212, 172, 82, 0.5)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: 22,
              width: 1,
              height: 26,
              marginLeft: -0.5,
              background: 'linear-gradient(180deg, rgba(212, 172, 82, 0.75), rgba(212, 172, 82, 0))',
            }}
          />
        </div>
      </div>

      {/* ===== Suit Cycle HUD (inner, independent layer) ===== */}
      <div
        data-ui="suit-cycle-hud"
        style={{ position: 'absolute', left: CENTER_X, top: CLUSTER_CENTER_Y, width: 124, height: 124, marginLeft: -62, marginTop: -62, pointerEvents: 'none' }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: 'radial-gradient(58% 58% at 50% 38%, rgba(16, 52, 54, 0.95) 0%, rgba(5, 10, 13, 0.97) 100%)',
            border: '1px solid rgba(176, 142, 66, 0.34)',
            boxShadow: '0 0 36px rgba(0, 0, 0, 0.85), inset 0 0 26px rgba(34, 128, 122, 0.22)',
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
            const isGold = i % 2 === 0; // YS(0), SN(2) gold; CT(1), NY(3) teal - matches the design's fixed per-corner palette
            const positionStyle: CSSProperties =
              i === 0
                ? { left: '50%', top: 3, marginLeft: -13 }
                : i === 1
                  ? { right: 3, top: '50%', marginTop: -13 }
                  : i === 2
                    ? { left: '50%', bottom: 3, marginLeft: -13 }
                    : { left: 3, top: '50%', marginTop: -13 };
            const motif = GOD_MOTIF[suit.god];
            return (
              <div
                key={suit.code}
                data-suit={suit.code}
                style={{
                  position: 'absolute',
                  ...positionStyle,
                  width: 26,
                  height: 26,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  border: isGold ? '1px solid rgba(198, 160, 78, 0.5)' : '1px solid rgba(96, 190, 178, 0.45)',
                  background: isGold ? 'rgba(48, 36, 12, 0.55)' : 'rgba(10, 44, 44, 0.55)',
                  borderRadius: motif === 'circle' ? '50%' : 0,
                  clipPath: motif === 'hex' ? HEX_CLIP_PATH : undefined,
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
                    width: 18,
                    height: 18,
                    transition: `transform ${tune.suitCycleRotationMs}ms ${tune.suitCycleRotationEasing}`,
                    transform: `rotate(${-suitDeg}deg)`,
                  }}
                >
                  <img src={symbolArtUrl(suit.god)} alt={suit.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
              </div>
            );
          })}
          <div style={{ position: 'absolute', inset: 26, borderRadius: '50%', border: '1px solid rgba(176, 142, 66, 0.14)' }} />
        </div>

        {/* The center hub is now a plain decorative disc - no text label.
            The wheel's own rotation (the badge sitting at the Invoker's
            seat is the current lead suit, highlighted by the lead-marker
            ring just below) is the only indicator now; a redundant
            "Lead: <name>" text would just duplicate it. */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 56,
            height: 56,
            margin: '-28px 0 0 -28px',
            borderRadius: '50%',
            background: 'radial-gradient(50% 50% at 50% 42%, rgba(14, 46, 48, 0.95), rgba(4, 9, 12, 0.97))',
            border: '1px solid rgba(176, 142, 66, 0.24)',
            boxShadow: 'inset 0 0 18px rgba(0,0,0,0.9)',
          }}
        />

        {/* Highlights whichever badge sits at the Invoker's actual seat
            (`markerSeat`) - not a fixed position, since the Invoker can be
            at any of the 4 seats. Positioned via `transform: translate()`
            (a single interpolatable property, unlike swapping between
            left/right/top/bottom which can't cross-animate) from a fixed
            center anchor, so it can transition smoothly - same timing/
            easing as the wheel's own rotation, so it visually travels
            together with the badge it's marking. */}
        <div
          data-ui="lead-marker"
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 36,
            height: 36,
            transition: `transform ${tune.suitCycleRotationMs}ms ${tune.suitCycleRotationEasing}`,
            transform: `translate(calc(-50% + ${MARKER_OFFSET[markerSeat].dx}px), calc(-50% + ${MARKER_OFFSET[markerSeat].dy}px))`,
            borderRadius: '50%',
            border: '1px solid rgba(120, 220, 206, 0.5)',
            boxShadow: '0 0 22px rgba(70, 200, 186, 0.4), inset 0 0 14px rgba(70, 200, 186, 0.22)',
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
                    background: 'linear-gradient(180deg, rgba(44, 34, 14, 0.95), rgba(12, 12, 12, 0.96))',
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
                Invoker
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

      {/* ===== Bottom row, left: Redistribution log - real =====
          Migrated here from a canvas-drawn stub (ui/renderGameView.ts's
          old renderRedistLogStub) now that it's laid out as part of this
          same coordinated DOM row alongside Sort/Action - see
          BUILD_STATUS.md. */}
      <button
        type="button"
        data-ui="redist-log-button"
        onClick={onOpenRedistLog}
        style={{
          position: 'absolute',
          left: 10,
          bottom: BOTTOM_ROW_BOTTOM,
          height: 36,
          padding: '0 10px',
          display: 'flex',
          alignItems: 'center',
          background: 'linear-gradient(180deg, rgba(16, 38, 38, 0.9), rgba(7, 15, 18, 0.92))',
          border: '1px solid rgba(120, 190, 178, 0.3)',
          clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
          color: 'oklch(0.86 0.04 176)',
          fontFamily: "'Cormorant Unicase', serif",
          fontWeight: 500,
          fontSize: 10,
          letterSpacing: '0.1em',
          cursor: 'pointer',
          pointerEvents: 'auto',
        }}
      >
        Redist. Log
      </button>

      {/* ===== Bottom row, right: Sort cards ("Order") - real ===== */}
      <button
        type="button"
        data-ui="sort-cards-button"
        onClick={onToggleSort}
        style={{
          position: 'absolute',
          right: 10,
          bottom: BOTTOM_ROW_BOTTOM,
          height: 40,
          padding: '0 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'linear-gradient(180deg, rgba(16, 38, 38, 0.9), rgba(7, 15, 18, 0.92))',
          border: '1px solid rgba(120, 190, 178, 0.3)',
          clipPath: 'polygon(7px 0, 100% 0, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0 100%, 0 7px)',
          color: 'oklch(0.86 0.04 176)',
          fontFamily: "'Cormorant Unicase', serif",
          fontWeight: 500,
          fontSize: 12,
          letterSpacing: '0.14em',
          cursor: 'pointer',
          pointerEvents: 'auto',
        }}
      >
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ display: 'block', width: 11, height: 1, background: 'currentColor' }} />
          <span style={{ display: 'block', width: 8, height: 1, background: 'currentColor' }} />
          <span style={{ display: 'block', width: 5, height: 1, background: 'currentColor' }} />
        </span>
        {sortLabel}
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
