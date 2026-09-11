## Current milestone

Rules popup concise rewrite: replaced the entire `SECTIONS` array in
`src/dom/rulesContent.ts` with a new 6-section, plain, bulleted version,
by explicit request - a full content/tone replacement of the previous
archaic prose voice, not a refinement.

## What was implemented

- Replaced all 8 old sections (setup, objective, cycle, offsuit, trick,
  redistribution, leadPlayer, noLimit) with 6 new ones, supplied in
  full: Goal, Start, Play a Card, Win the Trick, Redistribute, End the
  Game. Every section's `kicker` is now an empty string (no subtitle
  text was supplied this round, so none was invented) and every
  section's `body` is a list of short, concise bullet-style entries
  rather than flowing prose paragraphs.
- **Section 3 ("Play a Card") merges what were two separate old
  sections** (`cycle`'s Suit Cycle diagram and `offsuit`'s off-suit
  treatment) into one, with both `isCycle: true` and `isOffSuit: true`
  set simultaneously. Checked `RulesModal.tsx`'s rendering logic first:
  the Suit Cycle diagram and the off-suit/Double widget grid are two
  independent, sequential `{sec.isCycle && (...)}` / `{sec.isOffSuit
  && (...)}` JSX blocks with no shared state or mutual-exclusivity
  assumption between them - **no code change was needed** to support
  both flags on one section. Verified via Playwright: both the
  interactive Suit Cycle list (Yog-Sothoth → Cthulhu → Shub-Niggurath →
  Nyarlathotep, with the "↻ then Yog-Sothoth again" wrap note) and the
  "Off-suit Single" / "Double" two-card widget grid render correctly,
  stacked one after the other, inside the same "Play a Card" section.
- `NUMERALS` trimmed from 8 entries (`I`-`VIII`, sized for the previous
  8-section version) down to 6 (`I`-`VI`), matching the new section
  count exactly.
- Removed section ids ('setup', 'objective', 'cycle', 'offsuit',
  'trick', 'redistribution', 'leadPlayer', 'noLimit') were searched for
  across the whole codebase, not just `rulesContent.ts`. Found and
  fixed one real dangling reference: `RulesModal.tsx`'s `DEFAULT_OPEN`
  map (`{ objective: true, cycle: true }`, controlling which sections
  start expanded) still pointed at two now-nonexistent ids - updated to
  `{ goal: true, playCard: true }`, the new ids covering the same
  original intent (the "why play" section and the interactive-diagram
  section start open). All other codebase matches for words like
  `'offsuit'`/`'redistribution'` are unrelated real game-engine
  concepts (`PlayKind`, `BlockerNext`, `MaskedState['redistribution']`
  in `rules/types.ts`, `host/mask.ts`, `rules/engine.ts`, etc.) that
  happen to share a name with an old rules-popup section id purely by
  coincidence - confirmed these are a different thing entirely and left
  untouched.

## Key technical decisions

- Body entries are rendered as-is (one `<p>` per array entry, stacked
  with a small gap) rather than adding synthetic bullet-point glyphs:
  checked current rendering first, and `RulesModal.tsx` has never drawn
  a literal bullet marker - each `body[]` entry has always just been
  its own short paragraph. Since the new copy's bullets are already
  short, self-contained sentences, this "one line per entry" rendering
  reads correctly as a list without any change, matching the task's own
  fallback instruction ("plain line-per-entry if [bullets aren't
  supported]"). Verified visually via screenshot rather than assumed.
- Tone rotation (GOLD → TEAL → VIOLET → GOLD → TEAL → VIOLET) was
  already supplied correctly in the section data given, so no
  adjustment was needed - it's the same repeating 3-tone pattern used
  before this rewrite.
- Two additional copy fixes beyond the literal SECTIONS replacement,
  made because leaving them would have shipped an obvious, self-
  inflicted inconsistency directly caused by this same change:
  - The static intro line above section 1 ("Four are seated, two
    covenants contend, and the suits turn in an order no player may
    break.") was leftover archaic prose sitting directly above six
    brand-new concise sections. Replaced with "4 players, 2 secret
    Teams. Complete a Deity Suit to win." - reusing phrasing already
    present in the new Goal/Start sections rather than inventing new
    claims.
  - The off-suit widget's two hardcoded card labels/bodies (a static
    part of `RulesModal.tsx`, not `SECTIONS` data) still said "Single
    off-suit" / "Counts as rank 0. It never wins the trick." and "Twin
    Awakening" / "Two cards of equal rank, any suits. It may win." -
    old terminology that would now sit directly beside the new body
    text's "Off-suit Single" and "Double" labels. Renamed to match:
    "Off-suit Single" / "Face down. Rank 0. Cannot win." and "Double" /
    "Same rank, any Suits. Beats every Single." (phrasing reused
    directly from the new SECTIONS body text, not invented).

## Open questions

None - the full replacement text, tone rotation, and empty-kicker
instruction were all supplied explicitly; the two additional fixes
above were unambiguous consequences of the same change (old
terminology left stranded beside brand-new copy), not judgment calls
requiring the user's input.

## Known issues

None found. `screen: 'reconnecting'`'s unreachability (noted in a
previous task's BUILD_STATUS entry) is unrelated to this Rules-popup
change and still stands as previously reported.

## Next proposed step

None specified by this task; awaiting further direction.
