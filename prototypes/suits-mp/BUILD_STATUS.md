## Current milestone

Unified the Deity Symbol size/placement for Numbered (2-10) and Dormant
Deity Card states - both now use the exact same box (contain within
1130x1130, top y=170) instead of the original approved handoff's two
different sizes.

## What was implemented

- **`ui/cardArt.ts`**: merged `NUMBERED_SYMBOL_BOX` (760x760, top y=290)
  and `DORMANT_SYMBOL_BOX` (1130x1130, top y=170) into a single shared
  `SYMBOL_BOX` constant, using the former Dormant values. `buildCard()`'s
  main symbol/face layer step now places the Deity Symbol at `SYMBOL_BOX`
  for both the `'numbered'` and `'dormant'` branches (previously two
  separate `placeContain()` calls with different boxes) - Powered's
  handling (`POWERED_FACE_BOX` for the anime art, `POWERED_TOP_SYMBOL_BOX`
  for the small above-frame badge) is completely untouched.
- No new assets, no manifest/loader changes - this is purely a
  reference-canvas placement-constant change inside the existing shared
  compositor (`buildCard()`, used identically by the hand fan, every
  played-card recess, and the previous-trick log via
  `cardComponent.ts`'s `drawCard()`), so every caller picks this up
  automatically with no call-site changes.
- Rank glyph ("2"-"10" vs "1") and nameplate presence (Dormant only, per
  the existing invariant) are both untouched - confirmed by inspection
  that neither `rankGlyphText()` nor the nameplate step
  (`state === 'dormant' || state === 'powered'`) reference the symbol box
  at all, so this change couldn't have affected them.

## Key technical decisions

- **This deviates from the original GPT-approved "Approved Card System
  Implementation Handoff"**, which deliberately sized Numbered's symbol
  smaller than Dormant's to visually flag the Deity Card's special
  status. That distinction is now judged incorrect and removed per this
  task's explicit brief. Flagged prominently in `ui/cardArt.ts`'s own
  header comment (search for "DEVIATION FROM THE ORIGINAL APPROVED
  HANDOFF") so it's visible in-code, not just here, when
  `suits-mp-screen-reference.md` next gets reconciled by GPT/Codex - the
  Numbered-specific 760x760/y=290 box no longer exists anywhere in code.
- **One shared constant (`SYMBOL_BOX`) rather than two identical ones** -
  since Numbered and Dormant now use literally the same box, keeping two
  same-valued constants around would just invite them drifting apart
  again by accident in a future edit.

## How this was verified

- `npm run typecheck` / `npm run build` (repo root) - clean.
- **Direct compositor verification** (temporary debug hooks - a
  `window.__debugGame` in `main.ts`, a `window.__buildCard` in
  `cardArt.ts` - added, used, then fully reverted; `git diff` against
  `main` touches only `ui/cardArt.ts`): built a Numbered "6" and a
  Dormant card side by side for two Deities (Cthulhu, Yog-Sothoth) via
  the real `buildCard()` in the live booted scene. Confirmed visually
  that the symbol renders at the identical size and position in both
  states for the same Deity - the only differences are the rank glyph
  ("6" vs "1") and Dormant's nameplate underneath, exactly as specified.
- Live gameplay boot: `page.on('pageerror')` empty; console errors
  limited to the same pre-existing baseline noise from prior tasks (a
  sandboxed Google Fonts request, one intermittent unrelated 404).

## Open questions

None new. This task's own brief already anticipated and required the
handoff-deviation note above.

## Known issues

Carried over, untouched by this task: genuine gameplay verification of
off-suit masking via real bot/human play is still pending; Rules-modal
content gaps (no Setup section, off-suit hidden-identity nature unstated
in the copy); the other three seat tags still don't use
`ui_player_nameplate.png` (deliberate, from an earlier visual pass); the
`'partner'` hand-fan state still has no working visual differentiation
from `'legal'` (flagged, not fixed, in the previous task's
`BUILD_STATUS.md` - still open); the itch.io iframe canvas-scale fix,
the asset-preload progress bar's `PlayerGameScene` path, and the asset
pipeline's downscale/recompress output all still want a real-device/
live-deploy glance.

## Next proposed step

None specific to this task. Still open from prior tasks: decide on a
real visual treatment for `'partner'` state, and get a live-deploy check
on the last few canvas/asset-pipeline changes.
