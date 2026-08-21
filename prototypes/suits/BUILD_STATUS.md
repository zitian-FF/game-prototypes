## Current milestone

Feature-complete hotseat build of the full ruleset described in
`BRIEF.md`: 4-player pass-and-play trick-taking with hidden god/team
roles, the full suit-cycle/legal-move/redistribution/role-guess rules
engine, a rectangles-and-text Phaser UI covering every phase, a
quick-rules overlay, a per-player redistribution log, and DPR-aware
rendering. This is the hotseat original that `suits-mp` was later built
on top of as a true-multiplayer rebuild (see `suits-mp/BUILD_STATUS.md`)
— the two have since diverged and this prototype has not received any
of suits-mp's later bug fixes (see Known issues).

## What was implemented

- `src/rules/{types,cards,engine}.ts` — pure, Phaser-free rules engine:
  - `cards.ts`: the 40-card deck (4 gods x ranks 2-10 + Ace) built from
    the flavour-name table in `BRIEF.md`, the fixed suit rotation cycle
    (`YogSothoth -> Cthulhu -> ShubNiggurath -> Nyarlathotep -> repeat`),
    fixed team pairing (Chaos = Cthulhu+Nyarlathotep, Cosmos =
    ShubNiggurath+YogSothoth) and its `TEAMMATE_GOD` lookup, and a
    display-only suit-then-rank hand sort.
  - `engine.ts`: `initGame` (real shuffle-based deal, or a
    `ForcedDeal` for debug scenarios), `legalOptions`/`playCard`
    (required-suit-if-held, else off-suit single or same-rank double),
    `resolveTrick` (doubles beat all singles regardless of rank, highest
    double/single wins ties by latest play, Ace scores 11 instead of 1
    if any 10 was played that trick), `checkSuitCompletion` (fires
    immediately on any card gain, before redistribution UI), full
    redistribution flow (`proceedFromTrickResult` ->
    `chooseDelegate`/`redistribute`, mandatory delegate enforced by
    `chooseDelegate` rejecting the winner as their own delegate), and
    Role Revelation (`declareRoleGuess`/`submitRoleGuess`, trick 40+,
    one attempt per player, full-team stalemate if all 4 fail).
- `src/rules/debugScenarios.ts` — 5 hardcoded `ForcedDeal`s behind
  `?debug=1` (no-doubles Ace/10 interaction, single-double win, 2+
  competing doubles, suit-completion win, trick-40 role-guess
  eligibility), each validated at module load (`assertValidDeal`:
  40 unique known cards, 10 per hand, gods form a bijection). Fully
  inert without the query flag.
- `src/scenes/GameScene.ts` — the entire hotseat UI, phase-dispatched
  off `state.phase` (`blocker`/`turn`/`roleGuess`/`trickResult`/
  `chooseDelegate`/`redistribution`/`gameOver`):
  - Full-screen "Pass to `<name>`, tap when ready" blocker before every
    individual turn (not once per trick), resetting the redistribution
    log toggle and per-redistribution gift-selection state on advance.
  - Suit-cycle HUD (own-suit swatch highlighted, "start with any suit"
    for the leader, an arrow at the required suit otherwise), an
    always-visible win-condition banner (`owned`/`total` of the
    player's own suit), a faction HUD (own colour + teammate colour,
    never revealing the teammate's identity), and a public trick-so-far
    log shared between the `turn` and `trickResult` views.
  - Cards render as colour+rank boxes only (no flavour name/god label),
    legal options highlighted vs. dimmed via `legalOptions`; doubles are
    offered as a single tap when both cards of a rank are known, or a
    two-tap pick-and-confirm flow when the player must choose from more
    than 2 same-rank cards.
  - A bottom-right toggleable, per-viewer cumulative redistribution log
    (`receivedLog`) and a bottom-left toggleable quick-rules overlay
    (verbatim rules text reflowed for the 390px canvas).
  - Redistribution UI: tap a card then tap a recipient; a "Confirm"
    button is disabled until every contributing player has received
    exactly as many cards as they contributed.
  - Game-over screen reveals winning team/reason and all 4 players' god
    assignments.
- `src/input/intents.ts` — single `select` intent, byte-identical to
  `prototypes/digger`'s copy (intentionally not shared/extracted; see
  BRIEF.md's own note on this and the house "copy until third instance"
  rule).
- DPR-aware rendering (most recent commit): canvas backing store sized
  at `390x844 * PIXEL_RATIO` (capped at 2x) in `main.ts`; `GameScene`
  zooms its camera by the same `pixelRatio` and re-centers on the
  unchanged logical 390x844 world, and every `Text` call passes
  `resolution: this.pixelRatio` — applied as part of the repo-wide DPR
  retrofit pass, not a suits-specific feature.
- CI: `.github/workflows/deploy-suits-itch.yml` typechecks, builds with
  a relative base, prunes the build to suits' own output, and pushes to
  itch.io (`zitian-ff/suits`) via Butler on push to `main`. No R2
  asset-fetch step, matching the brief's "no real art" scope. `deploy.yml`
  also ships suits as part of the full Pages build.

## Key technical decisions

- No shared rules/UI code with `suits-mp` despite being its direct
  ancestor — per the house "no shared code library" rule, `suits-mp`
  started as a copy and has since diverged (see Known issues for what
  that means concretely).
- Cards are rendered as colour+rank only, never flavour name, so a
  glance at the table doesn't require reading; the flavour names exist
  only as reference data (`CARD_NAMES`) and in the win-detail/log text.
- The engine is written so trick collection and redistribution both key
  off `pendingWinnerId` for whose hand the cards actually live in
  (`playCard`'s 4th-play branch collects into `winnerId`'s hand;
  `redistribute` always reads/writes `state.players[winnerId].hand`,
  regardless of who the delegate/distributor is) — this keeps the
  10-cards-per-player invariant correct across both single- and
  double-win redistribution without extra bookkeeping.

## Open questions

- None found needing to be written back into `BRIEF.md` — the brief is
  thorough (data model, full rules text, hotseat UI behaviour, input,
  explicit out-of-scope list) and the implementation matches it
  wherever checked. No evidence in the reviewed commit history of a
  past session resolving an unwritten ambiguity.

## Known issues

- **Trick-1 forced opener is UI-only, not engine-enforced.** `BRIEF.md`
  requires the very first trick of the game to open with the Yog-Sothoth
  2 ("Blue 2"). `GameScene.renderTurn()` enforces this by only
  highlighting/allowing that one card (`isFirstTrickOpener`), but
  `engine.ts`'s `playCard()` has no equivalent check for `position === 0`
  beyond "one card, in hand" — a caller invoking `playCard` directly
  (bypassing the UI) could open trick 1 with any card. `suits-mp` (the
  networked rebuild) independently found and fixed the same category of
  gap by making a shared `isForcedTrick1Opener`/`forcedTrick1Opener`
  helper the single source of truth inside the engine itself, checked by
  its `playCard`, its bot AI, and its UI alike — that fix was never
  backported here.
- No automated tests. Rules-engine correctness (Ace/10 interaction,
  double-vs-double tie-breaking, redistribution invariants, suit-
  completion timing, trick-40 role-guess/stalemate) is exercised only
  by manually clicking through the 5 `?debug=1` forced-deal scenarios,
  never asserted programmatically. (`suits-mp` later added an automated
  50-game bot simulation for its fork of this same rules engine; no
  equivalent exists here.)
- No persistence across reloads (explicitly out of scope per
  `BRIEF.md`) — confirmed matching the game-over screen's own
  "Refresh the page to start a new game" text.
- Not verified in a real browser/Playwright this session (docs-only
  task scope; no code was touched). `npm run typecheck` and `npm run
  build` both pass cleanly as of this snapshot, but no visual/behavioral
  re-check was performed here.

## Next proposed step

If this hotseat prototype is picked back up (as opposed to work
continuing only on `suits-mp`), port the trick-1-forced-opener engine
fix from `suits-mp` back here so the rule can't be bypassed outside the
UI, and consider adding the equivalent of `suits-mp`'s automated
bot-simulation test for the shared parts of the rules engine (Ace/10,
doubles, redistribution invariants) before making further rules
changes.
