## Current milestone

Fixed a Double-play layout issue: a seat's play area drew a Double's 2
cards side by side at full width + gap, which could run off the
viewport at the left/right seats (closest to the screen edges). They
now overlap significantly instead.

## What changed

**Files changed**: `ui/renderGameView.ts` (`drawCardRow`'s spacing
logic), `tune.json` (1 new value). No changes to `rules/engine.ts`,
`host/gameHost.ts`, or network/broadcast timing - purely a canvas-layer
layout change to how an already-correct multi-card play is drawn.

- **`drawCardRow`**: previously spaced every card at
  `dims.width + CARD_GAP` regardless of count. Now: a single card
  (`faces.length === 1`, the common case - normal/offsuit plays) is
  completely unchanged, byte-for-byte the same math as before (the new
  formula reduces to the old one exactly when `faces.length === 1`,
  since the overlap term is multiplied by `faces.length - 1 = 0`).
  Multiple cards (currently only ever 2, a Double) now space at
  `dims.width * (1 - tune.doublePlayOverlapFraction)` instead - a
  significant overlap rather than full width + gap. Kept general to
  `faces.length` (a loop, not "2 cards" hardcoded) per the task's own
  instruction, even though nothing currently calls this with more than
  2 faces.
- **No z-order/depth change needed**: Phaser's container display list
  already draws later-added children on top of earlier ones, and
  `drawCardRow`'s existing `for (const face of faces)` loop already
  draws left-to-right in array order - so the left card was already
  "behind" and the right card already "in front" before this task.
  Only the *spacing* between them needed to change.
- **`tune.doublePlayOverlapFraction: 0.72`**: how much of each card's
  width the next card covers. Chosen by iterating with real Playwright
  screenshots at the left/right seats specifically (the tightest fit -
  see verification below): started at 0.6, which left only ~4.8px
  margin from the screen edge at those seats - too tight to call
  "comfortably within the viewport." Raised to 0.72, which gives ~9.4px
  margin on both sides (matching this codebase's existing
  `handFanEdgeMarginPx: 10` convention for what counts as a comfortable
  edge margin elsewhere), while a zoomed-in crop of the rendered result
  confirmed the covered (back) card's rank badge stays fully legible
  and a recognizable strip of its god symbol/frame remains visible -
  both card ranks in the crops read clearly at every seat tested.
  Binds automatically to the existing generic `?debug=1` Tweakpane
  panel, confirmed live.
- `drawCardRow` is shared by both the live play areas and the
  previous-trick log overlay (`renderPreviousTrickOverlay`, `CARD_DIMS_
  MINI`) - the fix applies to both call sites uniformly, rather than
  special-casing the play area only, since the log's own multi-card
  rows benefit from the same fraction-of-width overlap logic scaling
  correctly to its smaller card size.

## How this was verified

Real gameplay via Playwright (temporary `ForcedDeal`-based debug hooks
in `HostGameScene.ts`/`main.ts`, added and fully reverted before this
PR - `git diff --stat` against `main` confirms only `ui/renderGameView.
ts` and `tune.json` changed).

- `npm run typecheck` / `npm run build` (repo root) - clean.
- A Double play is never legal as the very first card of a trick
  (`rules/engine.ts`'s `playCard` forces `kind: 'normal'`, single card,
  at position 0), and which of the 3 non-leading positions is legal
  for a Double depends on that position's required suit versus the
  player's hand - and a bot's own choice between an eligible Double and
  an eligible offsuit single is genuinely random (`host/botAI.ts`'s
  `pickRandom`), not forceable through real legal-move selection alone.
  Rather than accept a per-seat 1-in-3 retry loop for a purely visual
  layout check, this task added one more temporary debug hook
  (`debugPlayCard`, calling the real `applyAction`/`playCard` validation
  directly for a specific slot - never bypassing legality, only
  bypassing which *legal* move a bot's own dice roll would have picked)
  and drove all 4 trick positions itself, deterministically, for 4
  separate scenarios - one per seat (`p0`/`p1`/`p2`/`p3`, i.e. bottom/
  left/top/right from the local viewer's own fixed `seatFor` mapping).
  Every play in every scenario was still a genuinely legal move by the
  real engine's own rules (an illegal `debugPlayCard` call is rejected
  exactly like any other), just chosen directly instead of by a bot's
  random pick.
- Confirmed via real rendered container geometry (not just eyeballing):
  at the left seat, the Double's row spans `[9.4, 106.6]` out of the
  390-wide screen; at the right seat, `[283.4, 380.6]` - both comfortably
  inside the viewport with matching ~9.4px margins on the side closest
  to the screen edge. Top and bottom (which sit near the horizontal
  center, not an edge) had far more room to spare in the screenshots.
- Playwright screenshots taken at all 4 seat positions (bottom/left/
  top/right) with a real Double rendered at each, confirming: the full
  card row stays within the viewport at every position (worst case the
  left/right seats, checked numerically above); zoomed-in crops at the
  left and right seats confirm the back card's rank badge stays fully
  legible and its symbol/frame remains recognizably visible under the
  overlap; a Single-card play elsewhere in the same screenshots (the
  leader's own play, plus the two non-Double positions in each
  scenario) is visually unchanged from its normal full-width
  appearance, consistent with the code proof above that the single-card
  formula is untouched.
- Browser console clean on a real, unforced boot into Single Player
  under `?debug=1` (only the pre-existing, unrelated sandboxed network
  noise - `net::ERR_CONNECTION_RESET` / a 404 - present on every boot
  in this environment).

**This change benefits from the user's own live verification on a
real device**, per the task's own explicit note - the numeric bounds
and zoomed crops above confirm the geometry and legibility are
correct, but "does 0.72 feel like the right amount of overlap, or
should it be tighter/looser" is a feel judgment the
`doublePlayOverlapFraction` Tweakpane field exists to retune live.

## Open questions

None - the task's own instructions (keep it general to `faces.length`,
don't touch the single-card case, verify visually at left/right
specifically) were specific enough that no mid-session clarification
was needed.

## Known issues

Carried over, untouched by this task: Rules-modal content gaps (no
Setup section, off-suit hidden-identity nature unstated in the copy);
`ui_player_nameplate.png` still applies to the local seat tag only
(deliberate); the `'partner'` hand-fan state still has no working
visual differentiation from `'legal'`; the itch.io iframe canvas-scale
fix, the asset pipeline's downscale/recompress output, the hand-fan
edge-bound fix, the Center HUD easing curve, the trick-result dwell
hold, the card-play arc animation, the Awakened reveal, the
end-of-trick collect animation, and now this Double-overlap fix all
still want a real-device/live-deploy glance. Also still worth flagging:
suits-mp still has no permanent `?debug=1`-gated `ForcedDeal` hook
(unlike the sibling `suits` prototype's `rules/debugScenarios.ts`) -
this is the sixth task in this feature area to build and tear down its
own one-off version, and this task specifically also needed a way to
drive a *specific* legal move deterministically (not just deal a
specific hand) to avoid a slow per-seat retry loop for a bot's own
random Double-vs-offsuit choice - worth folding that capability in too
if a permanent hook is ever built.

## Next proposed step

A real-device/live-deploy pass covering everything listed under "Known
issues" remains the next open loop - this Double-overlap fix's own
0.72 fraction (does it feel right at a glance, on a real phone,
compared to eyeballing screenshots) would be the highest-value addition
from this task's own follow-up.
