## Current milestone

Rules popup accuracy pass: reconciled the in-game Rules modal's own
content (`rulesContent.ts`'s `SECTIONS` array) against the current GDD
and verified live game behavior. This is a factual correction pass,
not a style rewrite - the existing archaic voice/tone rotation and
overall structure are preserved throughout.

## What was implemented

- Replaced the entire `SECTIONS` array with GDD-accurate content,
  supplied in full by the user:
  - **Added** a new opening section, "The Gathering" (`id: 'setup'`),
    covering secret Deity assignment and the mandatory 2-of-Yog-Sothoth
    opening lead - previously missing from the popup entirely.
  - **Renamed** the `'invoker'` section to `'leadPlayer'` ("The
    Invoker" → "The Lead Player"), and trimmed its body text (dropped
    "The Invoker tag sits beside their name," which no longer matches
    current UI - that tag was removed from the game overlay in an
    earlier task this session).
  - **Expanded** the off-suit section to note that an off-suit card is
    laid facedown with its rank/suit/Deity hidden from all players.
  - **Expanded** the trick-taking section to describe the '1' and '★'
    rank markers shown on Dormant vs. Powered Deity Cards.
  - All other section text (Objective, Turning of Suits, Offerings,
    the "No trick limit" closing section, and the suit-cycle list)
    reproduced verbatim as given, including its intentionally-preserved
    archaic wording (e.g. "No trick limit binds this rite...").
- **Bug fix required by the above**: `NUMERALS` (`['I'..'VII']`) only
  covered 7 entries, but the new setup section brings the total to 8 -
  without extending it, the last section ("Until the Suit is Claimed")
  would have rendered an `undefined` numeral. Extended to `['I'..'VIII']`.
- Searched the codebase for any other reference to the `'invoker'`
  section id (deep-linking, analytics, tests, hardcoded lookups) - none
  exist. `RulesModal.tsx` only ever reads `sec.id` generically (as a
  React key, a `data-section` attribute, and an open/closed-state map
  key), so the rename is fully self-contained to this one file. The two
  unrelated "Invoker" mentions in `GameOverlay.tsx` are code comments
  about the lead-marker ring feature (removed from the live UI in an
  earlier task this session) and don't reference this id.

## Key technical decisions

- Kept this as its own PR/branch (`proto/suits-mp/rules-popup-accuracy`),
  separate from the just-merged plain-language terminology pass
  (`proto/suits-mp/lobby-terminology-pass`, #104) even though both
  touched `rulesContent.ts` in the same session: that earlier pass had
  fixed two "rite" occurrences in this same file's "No trick limit"
  section as a sweep finding, but this task's own verbatim GDD-accurate
  text restores that exact archaic wording deliberately (the Rules
  popup keeps its own narrative voice; only the lobby/menu chrome was
  de-thematized). Rather than ship a fix that would immediately be
  reverted by this PR, `rulesContent.ts` was left untouched in #104 and
  this PR now applies its full, coherent diff directly against the
  merged main.

## Open questions

None - the full replacement text was supplied verbatim by the user, and
the only follow-on change needed (the `NUMERALS` array length) was a
direct, unambiguous consequence of adding one more section.

## Known issues

None found.

## Next proposed step

None specified by this task; awaiting further direction.
