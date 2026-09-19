## Current milestone

UI polish: +50% card rank/star glyph size; team-symbol size increased but
capped below the requested +50% after confirming overflow at full size.

## What was implemented

- `src/ui/cardArt.ts`: `RUNTIME_NUMERAL_SIZE` 158→237, `RUNTIME_STAR_SIZE`
  176→264 (both exactly +50%, reference-canvas units).
- `tune.json`: `localTeamSymbolSize` 40→**46** (not 60 - see overflow
  finding below).

## Key technical decisions

- **Card rank/star glyphs: full +50% applied, no overflow.** Verified via a
  scratch Phaser harness (`buildCard()` called directly, not committed)
  rendering the two widest real cases side by side: a "10" numeral (widest
  numeral, two characters) and a Powered Deity Card's "★". Both fit
  comfortably inside the frame's lower-left rank quadrant at the new size,
  with visible margin - screenshot confirms no clipping against the
  frame's decorative border.
- **Team symbol size: overflow confirmed at 60, capped at 46.** The local
  nameplate's right ("Team") compartment is a flex child (`flex: '1 1 0'`)
  of a fixed 260px-wide nameplate, sized ~121px by the flex split with the
  name compartment (`flex: '1.15 1 0'`), minus 6px horizontal padding each
  side ≈ 109px usable width for the two `god-chip` symbols plus
  `localTeamSymbolGap` (11px, unchanged). At size 60: 60+60+11=131px >
  109px available - confirmed via screenshot, the symbol pair visibly
  spills outside the nameplate's carved plate art entirely. Max safe size
  solving `2S+11≤109` is ~49px; chose 46 for a small safety margin.
  Screenshot-verified: both symbols sit cleanly inside the plate with
  visible margin at 46, a genuine ~15% increase over the original 40
  (vs. the requested 50%/60), per this task's own explicit instruction to
  use judgment rather than force a size the container can't hold.
- Did not touch `localTeamSymbolGap` or nameplate width/flex ratios -
  out of scope (task named only `localTeamSymbolSize`).

## Verification

`npm run typecheck`: pass
`npm run build`: pass
Visual check (per this task's own "skip exhaustive Playwright proof"
standing agreement, but "confirm no clipping directly" still required):
- Real screenshots (Single Player, Chromium via Playwright) of hand-fan
  and played cards at the new glyph size - numerals fit cleanly.
- A dedicated scratch-harness screenshot of a "10" and a Powered ("★")
  Deity Card at large size, confirming the two widest real cases don't
  clip (see above).
- Real screenshots of the local nameplate's Team compartment at size 60
  (overflow) and size 46 (clean fit) - both included this session.
- Console error check: `net::ERR_CERT_AUTHORITY_INVALID` (Google Fonts
  fetch) and one unrelated 404 appear identically on an unmodified `main`
  checkout in this sandbox - pre-existing environment/proxy limitation,
  not caused by this change. No new console errors introduced.

## Open questions

None - task was unambiguous; the overflow-handling instruction was
explicit ("use judgment on max safe size").

## Known issues

None introduced by this change.

## Next proposed step

If a larger team-symbol size is wanted later, it requires widening the
Team compartment itself (nameplate width and/or flex ratio between name
and Team compartments) - out of scope here since the task named only
`localTeamSymbolSize`.
