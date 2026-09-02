## Current milestone

GDD terminology audit of all DOM copy, read fresh from the live
"Suits of Madness GDD" doc (Google Drive, "ZT games" shared drive,
v2/suits-mp canon) rather than from memory of earlier versions or
prior briefs, per the task's explicit instruction. Found and fixed the
one already-known drift (`rulesContent.ts` saying "god" where GDD canon
is "Deity") plus one more instance of the same drift the known-issue
report hadn't called out, and audited every other DOM copy file for
the same class of problem. Also surfaced two larger, out-of-scope
findings along the way - see "Known issues" - that are about stale/
contradicted game *rules*, not word choice, and were deliberately left
untouched pending a separate decision. Version stamp counter unchanged
(`8`) at time of writing; no deploy has run for this fix yet.

## What was implemented

- **`dom/rulesContent.ts`**, The Objective section, both body lines -
  the only file with real terminology drift found anywhere in the DOM
  layer:
  - `"Each player is bound to a single god. Gather all ten cards of thy
    god's suit and thy covenant claims the victory."` -> `'Each player
    is bound to a single Deity. Gather all ten cards of thy Deity Suit
    and thy covenant claims the victory.'` - two "god"s fixed, and "thy
    god's suit" corrected to "thy Deity Suit" (the GDD's own compound
    noun for the 10-card collectible, not a possessive of "suit").
  - `'Two covenants contend: ... Thy kin holds the other god of thy
    covenant — either of you completing a suit wins it for both.'` ->
    `'... Thy kin holds the other Deity of thy covenant — either of
    you completing a Deity Suit wins it for both.'` - one "god" and one
    bare "suit" fixed; this second "suit" meant the same 10-card
    collectible as the Objective's other line (per GDD: "aim to collect
    all 10 cards of their Deity Suit"), not the Lead/Required Suit
    sense.
  - No other file changed - see the full audit below.

## Audit method and findings (for spot-checking against the GDD)

Read the live GDD fresh (fileId
`1u1ipZgYhoQVu5_YwI87_LBa6fh6y5d8ePH1zm16MJro`) rather than relying on
memory, then grepped every DOM file (`rulesContent.ts`, `RulesModal.tsx`,
`RedistLogModal.tsx`, `GameOverlay.tsx`, `overlayContent.ts`,
`gameOverlayStore.ts`, `LobbyFlow.tsx`, `lobbyContent.ts`,
`lobbySeats.ts`, `godArtUrl.ts`, `domUiStore.ts`, `mountDom.tsx`,
`DomRoot.tsx`) case-insensitively for "god" and "suit", then manually
classified every hit as player-facing copy vs. internal code (variable/
type names like `God`/`god`, `data-ui`/`data-god` attributes, code
comments) - only the former is in scope for a "DOM copy" fix, per the
task's own framing; renaming the `God` type or `god` fields throughout
the codebase would be a much larger, unrelated refactor.

- **"god" instances found and fixed**: exactly the two in
  `rulesContent.ts` above. No other player-facing copy anywhere in the
  DOM layer says "god" - every other hit was a code identifier,
  attribute, or comment.
- **Bare "suit" meaning "Deity Suit" found and fixed**: exactly the one
  in `rulesContent.ts` above ("completing a suit"). Every other bare
  "suit"/"suits" instance checked against the GDD and left alone
  because it's correctly the Lead Suit/Required Suit/Suit Cycle sense:
  "The Turning of Suits" (section title, Suit Cycle), "The suits lead
  in a fixed cycle... follow with the next suit in the sequence"
  (Suit Cycle), "Straying from the Suit" / "Lacking the demanded suit...
  lay a single card of any other suit" (Required Suit / off-suit play),
  "two cards of equal rank from any suits" (matches the GDD's own
  literal phrasing, "(any suits)", verbatim), and every `suit-cycle-*`/
  `data-suit`/`isOffSuit` code identifier in `GameOverlay.tsx`/
  `RulesModal.tsx`.
- **"covenant" (Team), "Twin Awakening" (Double), "The Offerings"
  (Redistribution), "Invoker" (the player who leads next)**: all
  confirmed as the task described - established flavor names for GDD
  mechanical nouns, not contradictions of them - and left untouched.
  "Invoker" specifically isn't itself named in the GDD text (which just
  describes the mechanic structurally: "the player who performed
  redistribution... leads the next trick"), so it's the same kind of
  flavor-name-for-an-unnamed-role as the others, not a drift from a
  GDD-given term - noted here since the task said to flag anything
  uncertain rather than guess, though this one reads as clearly the
  same pattern as the explicitly-approved terms.
- **No other DOM file had any "god"/"suit" hits needing a fix**:
  `GameOverlay.tsx`, `overlayContent.ts`, `gameOverlayStore.ts`,
  `LobbyFlow.tsx`, `lobbyContent.ts`, `lobbySeats.ts`, `godArtUrl.ts`,
  `RedistLogModal.tsx` (new this session) were all clean - their only
  hits were code identifiers/comments, or the product title "Suit of
  Madness" itself (not a rules term).

## Key technical decisions

- **Scoped strictly to player-facing copy, not code identifiers.** The
  `God` type, `god` fields/variables, `GOD_MOTIF`/`GOD_TEAM`/etc.
  constants, and `data-god`/`data-suit` DOM attributes all keep saying
  "god"/"suit" internally - renaming those throughout the codebase to
  match "Deity" would be a large, purely-cosmetic refactor across many
  files well outside "audit DOM copy," and the task explicitly framed
  this as a copy fix.

## Open questions

None on the terminology audit itself - the GDD was unambiguous on
every term checked. Two things surfaced during the audit are *not*
terminology questions but confirmed, out-of-scope rules-correctness
findings - flagged here rather than silently fixed or silently
ignored, per the task's own "flag rather than guess" instruction (even
though these aren't uncertain, they are unambiguously out of a
copy-only task's scope):

## Known issues

- **`rulesContent.ts`'s "The Fortieth Trick" section describes a
  mechanic the GDD v2 explicitly removed.** The GDD's "No Trick Limit"
  section says outright: "There is no trick limit or forced end
  condition... `[REMOVED v2 — former fixed-turn end condition]`." The
  Rules modal still has a whole section (`id: 'forty'`, title "The
  Fortieth Trick") describing a "closed by count" forced ending. This
  isn't a wording issue - the section describes something that
  shouldn't be presented as a rule to players at all - so it wasn't
  touched here; deciding what to do with it (delete the section
  entirely vs. replace it with GDD's actual "no trick limit" language)
  needs a real decision, not a word swap.
- **The rules engine itself still implements this same removed
  mechanic**, not just its Rules-modal description:
  `rules/engine.ts`'s `resolveTrick40ForcedEnd()` (referenced from a
  comment as "Trick-40 forced end (replaces the old role-guess win
  condition)") produces real end-game results with player-facing
  `detail` text like `"Trick 40 ended with no suit completed..."` and a
  `reason: 'trick40'` still defined in `rules/types.ts`. This means the
  actual game, not just its documentation, still has a forced ending
  the current GDD says doesn't exist. Left completely untouched - this
  is real gameplay-behavior code, well outside a "DOM copy" task, and
  removing a working end-game safeguard needs its own scoped task and
  probably a design conversation (GDD says stalemate is still possible
  via simultaneous completion, but doesn't say what stops a game that
  never completes any Deity Suit at all). Filed as a separate suggested
  task rather than acted on here.
- Carried over, still true, untouched by this task: facedown-card
  masking leak (`host/mask.ts`); no card-back art yet; the bottom HUD
  name tag can wrap for a long real name.

## Next proposed step

None for this terminology fix itself. The two rules-correctness
findings above are filed as a separate suggested task (trick-40
forced-end removal) rather than folded into this one.
