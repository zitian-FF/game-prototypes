# Suit of Madness

A 4-player hotseat trick-taking game with hidden roles. Rules engine and
UI notes below are the source of truth for this prototype.

## Data model

- 40-card deck: 4 gods (Cthulhu, Nyarlathotep, Shub-Niggurath,
  Yog-Sothoth) x 10 cards each (ranks 2-10 + Ace). Card names are the
  exact names supplied for this prototype (see `src/rules/cards.ts`,
  reproduced below) — no other design document was available when this
  prototype was built, so these names should be treated as placeholder
  flavour text unless/until a canonical design doc supersedes them.
- Shuffle is always genuinely random. No seed parameter for normal play.
- Behind `?debug=1`, the name-entry screen offers 4 hardcoded forced
  deals (`src/rules/debugScenarios.ts`) so Playwright can reliably
  exercise: a trick with no doubles, a trick where a single double wins,
  a trick where 2+ doubles compete, and a suit-completion win. This path
  is fully inert without `?debug=1` — normal dealing never touches it.
- 4 players, each secretly assigned one god, derived by shuffling the 4
  gods alongside the deck (not chosen by the player).
- Teams: Chaos = Cthulhu + Nyarlathotep. Cosmos = Shub-Niggurath +
  Yog-Sothoth.

### Card list (reference data)

| God | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | Ace |
|---|---|---|---|---|---|---|---|---|---|---|
| Cthulhu | Tentacles | Dream-Drift | Drowned Cultist | Murmurs from R'lyeh | Depthborn Servant | Ancient Leviathan | Abyssal Chant | Eye of the Sleeper | The Great Slumber | Heart of Cthulhu |
| Nyarlathotep | Whispering Masks | Mirage Walker | Cult of the Crawling Chaos | Black Wind | Veil of Illusions | Harbinger of Madness | Thousand Forms | Eyes in the Void | The Living Chaos | Aspect of Nyarlathotep |
| Shub-Niggurath | Root-Tangle Spawn | Bleeding Grove | Goat's Whisper | Fertile Rot | Fungal Surge | The Thousand Young | Unnatural Bloom | Forest That Devours | Black Goat's Awakening | Seed of Shub-Niggurath |
| Yog-Sothoth | Flicker of the Void | Timeless Observer | Astral Pulse | Orb-Watcher | Portal Lattice | Voice Through Dimensions | Keeper of Keys | Star-Fused Knowledge | Gate Beyond All Time | Core of Yog-Sothoth |

## Rules engine (`src/rules/engine.ts`, pure functions, no Phaser)

### Setup
- Deal 10 cards to each of 4 players.
- Whoever holds Yog-Sothoth's 2 leads trick 1.
- Fixed clockwise seat order = entry order.

### Suit rotation
- Fixed cycle: Yog-Sothoth -> Cthulhu -> Shub-Niggurath -> Nyarlathotep
  -> repeat.
- The lead player plays any single card; its suit sets the cycle's
  starting point for the trick.
- Each subsequent player's required suit advances one step in the cycle
  per player, regardless of what was actually played.

### Legal moves per turn
- Holding >=1 card of the required suit: must play exactly one card of
  that suit (any rank).
- Holding 0 cards of the required suit: must play either a single
  off-suit card (scores 0), or a double (two same-rank cards, any
  suits) if one is available. These two options are mutually exclusive
  with a required-suit play.

### Trick length and winning
- Always exactly 4 turns. Table therefore holds 4-8 cards.
- No doubles played: compare all played cards by rank (off-suit = 0,
  numbered = face value, Ace = 1 unless a 10 was played anywhere this
  trick, then every Ace = 11). Ties broken by latest turn order.
- One or more doubles played: doubles always beat every single,
  regardless of numeric rank. Highest double wins (same Ace/10 rule and
  tiebreak, evaluated only among doubles).

### Redistribution
- Trick winner collects every played card into their hand, then gives
  back exactly what each other player contributed (1 card for a
  single, 2 for a double), face-down, their choice of which cards.
- Single-win: winner redistributes themself.
- Double-win: winner MUST designate a different player to redistribute
  on their behalf (mandatory delegate; enforced in the UI by never
  offering the winner as an option).
- Next trick is led by whoever performed the redistribution.

### Win conditions
- Primary: after any card gain (trick win or redistribution), if a
  player holds all 10 cards of their own assigned god's suit, their
  team wins immediately.
- Role Revelation: from trick 40 onward, the player about to lead may
  forfeit their lead to guess all 4 players' gods. Fully correct wins
  for their team; wrong uses up that player's one attempt permanently.
  If all 4 players have used and failed their attempt, the game ends
  in a stalemate.

## Hotseat UI

- Name entry (plain HTML overlay) collects 4 names before dealing.
- A full-screen blocker ("Pass to `<name>`, tap when ready") appears
  before every individual turn — not once per trick — hiding hands and
  the personal log. Cards already on the table this trick are public
  and shown without a blocker.
- Turn view: hand as rectangles labelled with card name + rank,
  highlighted when legal / dimmed when not. Forced off-suit situations
  present the single-card option and any double option as distinct,
  separately tappable choices. Perspective-scoped log: this trick's
  plays so far, and only the most recent redistribution this player
  received (not cumulative history).
- End of trick shows the public result, then hands the winner (or
  their mandatory delegate) the redistribution decision through the
  same blocker pattern.
- End of game reveals the winning team, the reason (suit completion /
  role guess / stalemate), and all 4 players' god assignments.

## Input

- All interaction goes through a minimal select intent
  (`src/input/intents.ts`), mirroring `prototypes/digger`'s
  pointerdown -> world-coordinates -> hit-test pattern. Not shared code
  with digger (this is only the second instance of the pattern; see
  root `CLAUDE.md`).

## Out of scope

No networking, no real art (rectangles + text only), no sound, no
AI/bot players, no persistence across reloads, no Tweakpane/tune.json,
no animation beyond simple functional transitions.
