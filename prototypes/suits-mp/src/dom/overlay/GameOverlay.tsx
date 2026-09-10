import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import './GameOverlay.css';
import { SEAT_DEG, SEAT_ORDER, SUITS } from './overlayContent';
import type { GodChipState, SeatDelegateState } from './gameOverlayStore';
import type { SeatPosition } from '../../ui/seating';
import { GOD_MOTIF } from '../../rules/godArt';
import { GOD_DISPLAY_NAME } from '../../rules/cards';
import type { God } from '../../rules/types';
import {
  HEX_CLIP_PATH,
  actionSlabStateUrl,
  currentTurnPointerUrl,
  nameplateUrl,
  remoteNameplateUrl,
  squareControlUrl,
  suitCycleBezelUrl,
  symbolArtUrl,
} from '../godArtUrl';
import type { ActionSlabState, RemoteNameplateState } from '../godArtUrl';
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
// Shared bottom anchor for the three-part bottom row (Set / Action / Log) -
// see BUILD_STATUS.md for why these three, previously scattered (one of
// them canvas-drawn), are now one coordinated DOM row. Reduced from 54 (by
// explicit user direction - 2026-09-10 nameplate-glow-lead-tag-cleanup
// task) to reclaim vertical room the action button's own 50% enlargement
// (177x78 -> 266x117) ate into: growing the button in place at the old
// anchor pushed its top edge 39px further up the screen, leaving no room
// for a full-height hand-fan card between it and the contextual hint
// panel above (see ui/renderGameView.ts's FAN_BASELINE_Y comment for the
// full budget this and that value were jointly re-tuned against).
const BOTTOM_ROW_BOTTOM = 16;
// The Required Suit banner sits between the player cluster and the hand
// fan - the player-facing prompt for what must be followed this trick, per
// this task's board requirements (it does not duplicate the suit symbol
// already shown by the Suit Cycle HUD ring above it - this is the only
// spot that also names the suit in text). Nudged down from 590 (2026-09-10
// nameplate-glow-lead-tag-cleanup task) - the local nameplate directly
// above grew taller (56x56 Team symbols, up from 36x36) and its own
// bottom edge now lands past the old 590, which would otherwise overlap.
const REQUIRED_SUIT_BANNER_TOP = 596;
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
// Sized against the recess's own real opening, not guessed: measured
// directly off ui_suit_cycle_bezel.png's pixels, the dark circular well
// (where the bright metal ring gives way to the sunken recess) spans
// ~0.273 of the bezel's own full width/height - about 45.8px at this
// HUD's 168px display size. Every deity_symbol_<deity>.png master also
// has real transparent padding baked around its own visible backplate
// (the hex/circle badge itself, not just the glyph inside it) - it only
// fills ~59-68% of its own 1024x1024 canvas, confirmed by trimming each
// master to its non-transparent bounding box - since `objectFit: contain`
// scales that whole padded canvas uniformly, the *visible* backplate ends
// up noticeably smaller than this container. Per the 2026-09-10 live-
// asset-layout-corrections brief, the visible backplate should land at
// ~75-80% of the recess's own diameter (not fill or exceed it, per the
// prior task's 0.37 fraction, which put it closer to ~88% and let it
// crowd the ring) - sized here against the limiting (largest) content-
// fill fraction across all four symbols (0.681, Cthulhu/Nyarlathotep's
// own canvas height) so no single Deity's backplate exceeds that ~75-80%
// band: 0.775 (midpoint) * 0.273 (recess) / 0.681 (limiting fill) =
// ~0.311 as a starting point, nudged up to 0.335 after a live screenshot
// pass measured the actual rendered badge (its own dark backplate fill,
// not the brighter glow/icon inside it) landing a little under that band
// at 0.311 - tunable live via `?debug=1` since this is a feel/fit value,
// not a fixed geometric fact like RECESS_OFFSET_FRACTION above. Each
// symbol master's own visible content is already centered within its own
// canvas (confirmed via the same bounding-box measurement, per the
// brief's "center using visible alpha bounds" requirement), so no
// separate centering offset is needed beyond the existing translate/
// objectFit centering below - the counter-rotation pivot (this same
// anchor's own center) already coincides with both the recess center and
// the symbol's own visible center as a result.
const RECESS_SYMBOL_SIZE = HUD_SIZE * tune.suitCycleSymbolSizeFraction;
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

  // Real "currently held down" tracking for the two button families that
  // now need a genuine `pressed` visual state (2026-09-10 asset handoff):
  // a remote seat's delegate-selection tag, and the bottom Action button.
  // Pure presentation bookkeeping - never touches game state - since
  // "pressed" is a transient pointer/touch concept the game logic
  // (computeSeatDelegateState/computeActionButtonState in renderGameView.
  // ts) has no reason to know about; only `tappable`/`staged`/
  // `actionEnabled` are real game-state facts. Cleared defensively
  // whenever the previously-pressed seat/button is no longer actionable
  // (e.g. the phase moved on mid-press) so a stuck press can't linger.
  const [pressedSeat, setPressedSeat] = useState<SeatPosition | null>(null);
  useEffect(() => {
    if (pressedSeat !== null && !seatDelegate[pressedSeat].tappable) setPressedSeat(null);
  }, [pressedSeat, seatDelegate]);
  const [actionPressed, setActionPressed] = useState(false);
  useEffect(() => {
    if (actionPressed && !actionEnabled) setActionPressed(false);
  }, [actionPressed, actionEnabled]);
  // See the Action button's own render-site comment below for the full
  // rationale behind this specific 4-way mapping.
  const actionVisualState: ActionSlabState = !actionEnabled ? (actionLabel.startsWith('Waiting') ? 'waiting' : 'disabled') : actionPressed ? 'pressed' : 'ready';

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
                      stays deliberately absent from this screen. That was
                      true of the original Center HUD spec's intent from
                      the start, but a separate per-seat "Lead Player" text
                      tag (`data-ui="trick-starter-tag"`) had lingered
                      below the seat it belonged to regardless - it
                      predated this spec and was never actually covered by
                      it. Removed entirely (2026-09-10 nameplate-glow-lead-
                      tag-cleanup task): the wheel's own rotation-to-seat
                      behavior plus this LEAD label, and the played card's
                      own position in a trick, already identify who led -
                      the redundant tag added no information a Center HUD
                      glance doesn't already give. `starterSeat` (this
                      recess's own rotation math, above) is unaffected -
                      only the standalone tag is gone. */}
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

      {/* ===== Player name displays ===== */}
      {SEAT_ORDER.map((seat) => {
        const isLocal = seat === 'bottom';
        const delegate = seatDelegate[seat];
        const tagTop = seat === 'top' ? TOP_TAG_TOP : seat === 'bottom' ? BOTTOM_TAG_TOP : SIDE_TAG_TOP;
        // The local nameplate is now the two-compartment ui_player_
        // nameplate.png (name + team/Deity identity merged into one
        // control - see BUILD_STATUS.md), wider than a plain name tag to
        // fit its right compartment's team text + two symbol icons.
        //
        // The three remote seats share one uniform width/height
        // (tune.remoteNameplateWidth, height derived from the real
        // ui_remote_player_nameplate_*.webp source aspect ratio - a
        // measured, exact 1774:887 = 2:1 across all four states) per the
        // 2026-09-10 live-asset-layout-corrections brief: the prior width-
        // only sizing (94-120px wide, squashed into a flat 34px-tall box)
        // ignored that real aspect ratio, crushing the carved plate into
        // an illegible sliver. Width can't grow much further at left/
        // right - it's anchored at a fixed 10px from the screen edge and
        // the Center HUD's own box starts at x=111, so 96px leaves a ~5px
        // clearance - which is exactly why the brief calls for growing
        // height instead of stretching width.
        const width = isLocal ? 260 : tune.remoteNameplateWidth;
        const remoteHeight = tune.remoteNameplateWidth / 2;
        const horizontal: CSSProperties =
          seat === 'left' ? { left: 10 } : seat === 'right' ? { right: 10 } : { left: CENTER_X - width / 2 };

        return (
          <div key={seat} data-ui="seat" data-seat={seat} style={{ position: 'absolute', top: tagTop, width, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: isLocal ? 6 : 5, ...horizontal }}>
            {isLocal ? (
              // Merged local identity nameplate (2026-09-10 asset handoff):
              // ui_player_nameplate.png is a neutral two-compartment base
              // with no baked text/symbols - this single control now
              // covers what used to be two separate DOM blocks (a plain
              // name tag, plus a lower "Team HUD" panel with its own
              // procedural background). Left compartment: runtime player
              // name only, never "(You)" (seatLabels['bottom'] already
              // omits it - see renderGameView.ts's rawPlayerNameFor).
              // Right compartment: runtime "TEAM COSMOS"/"TEAM CHAOS" text
              // plus the two canonical deity_symbol_*.png masters for that
              // team, with a small "YOU" marker under the local player's
              // own symbol only (yourGodChip.label - see
              // computeGameOverlayHudState). Per the 2026-09-10 live-
              // asset-layout-corrections brief, this reconciles the prior
              // task's own interim "Kin" label choice on the teammate's
              // symbol (kept then only pending explicit clarification,
              // per that task's own BUILD_STATUS.md open question) - the
              // brief is that clarification, and it calls for no label at
              // all on the teammate's icon; not revealing which remote
              // seat *is* that teammate is unaffected either way, since
              // this whole compartment already only ever showed the
              // Team's two Deities, never a seat/player identity. The
              // local seat is never a delegate-selection target (a player
              // can't delegate to themself), so there's no staged/
              // tappable state to preserve here the way the remote seat
              // tags below need to.
              //
              // No boxShadow here - a `0 0 30px rgba(196, 156, 66, 0.22)`
              // ambient glow used to sit on this div (removed per the
              // 2026-09-10 nameplate-glow-lead-tag-cleanup task). Confirmed
              // via a real screenshot A/B (glow present vs. removed) that
              // it was the actual source of a visibly lighter rectangular
              // patch behind this plate: with no `border-radius` on this
              // div, the shadow followed the div's own plain rectangular
              // border box rather than the carved plate art's real
              // beveled/notched silhouette, so it read as a flat glowing
              // rectangle bleeding onto the board background on every
              // side, not a soft ambient highlight. Not a design element
              // worth keeping in a reshaped form - nothing else in this
              // file's local/remote nameplates uses an outer glow, and the
              // plate art itself already carries all the visual weight it
              // needs.
              <div
                data-ui="local-nameplate"
                style={{
                  width: '100%',
                  minHeight: 64,
                  boxSizing: 'border-box',
                  display: 'flex',
                  alignItems: 'stretch',
                  background: `linear-gradient(180deg, rgba(20, 16, 8, 0.15), rgba(4, 4, 3, 0.3)), url(${nameplateUrl()}) center/100% 100% no-repeat`,
                }}
              >
                <div style={{ flex: '1.15 1 0', minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '0 8px' }}>
                  <span style={{ color: 'oklch(0.84 0.11 84)', fontSize: 11, textShadow: '0 0 12px rgba(226, 182, 84, 0.8)' }}>✦</span>
                  <span
                    data-bind="player-name"
                    style={{
                      fontFamily: "'IM Fell English SC', serif",
                      fontSize: 17,
                      letterSpacing: '0.02em',
                      color: 'oklch(0.95 0.04 90)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      minWidth: 0,
                    }}
                  >
                    {seatLabels[seat]}
                  </span>
                </div>
                <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, padding: '4px 6px' }}>
                  <span
                    data-bind="team-name"
                    style={{
                      fontFamily: "'Cormorant Unicase', serif",
                      fontWeight: 600,
                      fontSize: 8,
                      letterSpacing: '0.14em',
                      color: 'oklch(0.88 0.09 88)',
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {teamName}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    {/* Symbols sized to tune.localTeamSymbolSize - ~2x the
                        prior fixed 18px, per the brief's "increase both
                        Deity symbols to approximately twice their current
                        size" - the outer compartment's own minHeight above
                        was grown to fit this cleanly. teammateGodChip.label
                        is now '' (see computeGameOverlayHudState) - a
                        fixed-height label slot is still reserved for both
                        chips regardless of whether either has real text,
                        so the two icons stay aligned at the same vertical
                        position rather than the labelled one sitting
                        visually higher. */}
                    {[yourGodChip, teammateGodChip].map((chip) => {
                      const motif = chip.god ? GOD_MOTIF[chip.god] : 'circle';
                      return (
                        <div key={chip.code} data-ui="god-chip" data-god={chip.code} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                          <div
                            style={{
                              width: tune.localTeamSymbolSize,
                              height: tune.localTeamSymbolSize,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              overflow: 'hidden',
                              borderRadius: motif === 'circle' ? '50%' : 0,
                              clipPath: motif === 'hex' ? HEX_CLIP_PATH : undefined,
                            }}
                          >
                            {chip.god && <img src={symbolArtUrl(chip.god)} alt={chip.code} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
                          </div>
                          <span style={{ fontFamily: "'Cormorant Unicase', serif", fontWeight: 600, fontSize: 6, letterSpacing: '0.1em', color: 'rgba(252, 226, 164, 0.75)', minHeight: 7 }}>
                            {chip.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              (() => {
                // Real 4-state remote nameplate art (2026-09-10 asset
                // handoff), replacing the former procedural teal/gold
                // staged/not-staged treatment. Priority order top to
                // bottom: `pressed` is the current, transient touch/
                // pointer-down feedback and wins over everything else
                // while the finger/mouse is actually down; `selected` is
                // this task's own answer for "current confirmed/selected
                // delegate" - this codebase has no persistent post-commit
                // "confirmed delegate" interval to show it in (the whole
                // delegate-picker UI disappears the instant the real
                // selectDelegate action resolves), so per the handoff's own
                // "retain the state for the confirmed transition or short
                // confirmation state" instruction, it's mapped to the local
                // pre-commit staged pick instead (`staged`) - see
                // BUILD_STATUS.md; `eligible` is any other tappable target
                // during selectDelegate; `neutral` is everything else
                // (delegation not currently active). Every state still
                // shows no team/Deity/teammate/suit information whatsoever
                // - only the plain runtime name label, per the GDD's
                // Information Visibility rule.
                const visualState: RemoteNameplateState =
                  delegate.tappable && pressedSeat === seat
                    ? 'pressed'
                    : delegate.staged
                      ? 'selected'
                      : delegate.tappable
                        ? 'eligible'
                        : 'neutral';
                return (
                  <button
                    type="button"
                    data-ui="seat-tag"
                    data-tappable={delegate.tappable}
                    data-visual-state={visualState}
                    onClick={delegate.tappable ? delegate.onPick : undefined}
                    onPointerDown={delegate.tappable ? () => setPressedSeat(seat) : undefined}
                    onPointerUp={() => setPressedSeat((s) => (s === seat ? null : s))}
                    onPointerLeave={() => setPressedSeat((s) => (s === seat ? null : s))}
                    onPointerCancel={() => setPressedSeat((s) => (s === seat ? null : s))}
                    disabled={!delegate.tappable}
                    style={{
                      width: '100%',
                      height: remoteHeight,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: seat === 'top' ? '0 10px' : '0 7px',
                      boxSizing: 'border-box',
                      border: 0,
                      background: `url(${remoteNameplateUrl(visualState)}) center/100% 100% no-repeat`,
                      cursor: delegate.tappable ? 'pointer' : 'default',
                      font: 'inherit',
                      // The root overlay wrapper is deliberately click-
                      // through (`pointerEvents: 'none'` at this file's
                      // own top) so ordinary board/canvas taps reach the
                      // canvas beneath it - every other real interactive
                      // element here (Sort/Action/Menu/Redist-Log buttons)
                      // explicitly opts back in with its own
                      // `pointerEvents: 'auto'`. Scoped to
                      // `delegate.tappable` (rather than always 'auto') so
                      // a non-tappable seat tag - true prior to the actual
                      // selectDelegate phase, i.e. the game's usual state -
                      // still lets ordinary board taps in that area reach
                      // the canvas underneath.
                      pointerEvents: delegate.tappable ? 'auto' : 'none',
                    }}
                  >
                    <span
                      data-bind="player-name"
                      style={{
                        fontFamily: "'IM Fell English SC', serif",
                        fontSize: seat === 'top' ? 15 : 14,
                        letterSpacing: '0.02em',
                        color: 'oklch(0.90 0.02 100)',
                        textShadow: '0 1px 3px rgba(0, 0, 0, 0.85)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        minWidth: 0,
                      }}
                    >
                      {seatLabels[seat]}
                    </span>
                  </button>
                );
              })()
            )}
          </div>
        );
      })}


      {/* ===== Contextual hint panel (Required Suit / Any Suit) - real =====
          Reusable region for a short contextual hint - Required Suit today,
          future tutorial/gameplay hints later (per the 2026-09-10 live-
          asset-layout-corrections brief) - sitting strictly between the
          local nameplate and the hand fan (never overlapping either).
          Previously full-width (390 - 2*14 = 362px), which read as an
          oversized bar crowding the hand below it; now sized/centered per
          the brief's own explicit numbers (~58% of the 390px reference
          viewport width, ~45-50px tall) rather than stretching edge to
          edge. "Required Suit" shortened to "Suit" so the longest
          canonical god name (Nyarlathotep, 12 characters) still fits
          alongside the icon and label at this narrower width. */}
      <div
        data-ui="required-suit-banner"
        style={{
          position: 'absolute',
          left: CENTER_X - tune.contextualHintWidth / 2,
          width: tune.contextualHintWidth,
          top: REQUIRED_SUIT_BANNER_TOP,
          height: tune.contextualHintHeight,
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          padding: '0 10px',
          background: 'linear-gradient(180deg, rgba(10, 34, 36, 0.82), rgba(5, 14, 17, 0.86))',
          border: '1px solid rgba(120, 190, 178, 0.28)',
        }}
      >
        {requiredSuitGod ? (
          <span
            style={{
              width: 18,
              height: 18,
              flexShrink: 0,
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
            whiteSpace: 'nowrap',
          }}
        >
          Suit
        </span>
        <span
          style={{
            fontFamily: "'IM Fell English SC', serif",
            fontSize: 15,
            color: 'oklch(0.86 0.09 178)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            minWidth: 0,
          }}
        >
          {requiredSuitGod ? GOD_DISPLAY_NAME[requiredSuitGod] : 'Any Suit'}
        </span>
      </div>

      {/* ===== Top-left: Menu - real =====
          New hub (dom/MenuModal.tsx) hosting Rules and the previous-trick
          log, replacing the old canvas-drawn top-bar Rules/Log buttons -
          see ui/renderGameView.ts's renderTopBar. Real ui_square_control.
          png background (2026-09-10 asset handoff) - resolves the prior
          "no dedicated square-button asset exists" gap; shared by Menu/
          Sort/Log alike, icon/label stay runtime content. */}
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
          border: 0,
          background: `url(${squareControlUrl()}) center/100% 100% no-repeat`,
          color: 'oklch(0.86 0.09 84)',
          fontFamily: "'Cormorant Unicase', serif",
          fontWeight: 500,
          fontSize: 10,
          letterSpacing: '0.1em',
          textShadow: '0 1px 3px rgba(0, 0, 0, 0.85)',
          cursor: 'pointer',
          pointerEvents: 'auto',
        }}
      >
        <span style={{ fontSize: 15, lineHeight: 1 }}>☰</span>
        Menu
      </button>

      {/* ===== Bottom row, left: hand sort ("Sort") - real =====
          Same ui_square_control.png background as Menu/Log above. Label
          corrected to "Sort" - "Set" was never the canonical label (see
          suits-mp-screen-reference.md's own explicit correction). */}
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
          border: 0,
          background: `url(${squareControlUrl()}) center/100% 100% no-repeat`,
          color: 'oklch(0.86 0.09 84)',
          fontFamily: "'Cormorant Unicase', serif",
          fontWeight: 500,
          fontSize: 10,
          letterSpacing: '0.1em',
          textShadow: '0 1px 3px rgba(0, 0, 0, 0.85)',
          cursor: 'pointer',
          pointerEvents: 'auto',
        }}
        aria-label={sortLabel}
      >
        <span style={{ fontSize: 15, lineHeight: 1 }}>⌘</span>
        Sort
      </button>

      {/* ===== Bottom row, right: Redistribution log ("Log") - real =====
          Same ui_square_control.png background as Menu/Sort above. */}
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
          border: 0,
          background: `url(${squareControlUrl()}) center/100% 100% no-repeat`,
          color: 'oklch(0.86 0.09 84)',
          fontFamily: "'Cormorant Unicase', serif",
          fontWeight: 500,
          fontSize: 10,
          letterSpacing: '0.1em',
          textShadow: '0 1px 3px rgba(0, 0, 0, 0.85)',
          cursor: 'pointer',
          pointerEvents: 'auto',
        }}
      >
        <span style={{ fontSize: 15, lineHeight: 1 }}>☷</span>
        Log
      </button>

      {/* ===== Bottom row, center: Action button - real =====
          Real 4-state ui_action_slab_*.png background (2026-09-10 asset
          handoff), replacing the old two-layer procedural gold/gray
          gradient treatment - resolves the prior "remains unresolved"
          open question on whether an action-slab asset should back this
          button. Label/hint stay runtime text (actionLabel/actionHint),
          unchanged. State mapping (see BUILD_STATUS.md): `pressed` while
          actively held down; `ready` when actionEnabled and not currently
          pressed; when !actionEnabled, `waiting` if the real reason is
          "not your turn at all" (computeActionButtonState's own "Waiting
          for X..."/"Waiting..." labels - the one case this button can tell
          apart from `actionLabel` itself, its only signal here) vs
          `disabled` for every other not-yet-actionable case (e.g. "Select
          a card to play" with nothing selected yet).

          Sized via tune.actionButtonWidth/Height, grown in two passes:
          154x58 -> 177x78 (~15% wider/~35% taller, 2026-09-10 live-asset-
          layout-corrections brief - the old box was short enough that
          two-line label+hint text, e.g. "Delegate to Player 2" / "Commit
          the chosen card", could overflow past the visible slab art's own
          top/bottom edge) -> 266x117 (a further 50% up from that, per the
          2026-09-10 nameplate-glow-lead-tag-cleanup task, keeping the
          same aspect ratio the prior pass already settled on since
          scaling both axes by one uniform factor can't change it). Text
          stays centered via flex within this same box (bound to the
          asset's own bounds, not separate procedural coordinates), so it
          re-centers automatically at the new size with no layout math of
          its own to update. */}
      <button
        type="button"
        data-ui="action-button"
        data-enabled={actionEnabled}
        data-visual-state={actionVisualState}
        onClick={actionEnabled ? onAction : undefined}
        onPointerDown={actionEnabled ? () => setActionPressed(true) : undefined}
        onPointerUp={() => setActionPressed(false)}
        onPointerLeave={() => setActionPressed(false)}
        onPointerCancel={() => setActionPressed(false)}
        disabled={!actionEnabled}
        style={{
          position: 'absolute',
          left: CENTER_X - tune.actionButtonWidth / 2,
          bottom: BOTTOM_ROW_BOTTOM,
          width: tune.actionButtonWidth,
          height: tune.actionButtonHeight,
          boxSizing: 'border-box',
          border: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          padding: '0 16px',
          background: `url(${actionSlabStateUrl(actionVisualState)}) center/100% 100% no-repeat`,
          cursor: actionEnabled ? 'pointer' : 'not-allowed',
          pointerEvents: 'auto',
        }}
      >
        <span
          style={{
            fontFamily: "'IM Fell English SC', serif",
            fontSize: 21,
            letterSpacing: '0.06em',
            color: actionEnabled ? 'oklch(0.97 0.04 92)' : 'rgba(150, 176, 174, 0.4)',
            textShadow: actionEnabled ? '0 0 16px rgba(252, 216, 130, 0.6)' : '0 1px 3px rgba(0, 0, 0, 0.85)',
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
      </button>
    </div>
  );
}
