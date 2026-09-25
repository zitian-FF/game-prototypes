## Current milestone

Player-facing copy has been aligned with the canonical Suits of Madness GDD.

## What was implemented

- Replaced embellished lobby language with clear Room, Player, Host, Bot, Connection, and Game terms. Buttons now use Add Bot, Remove Bot, and Refresh Code; copy confirmation says Link copied.
- Updated join, waiting, host-disconnected, joining, and reconnecting text to the GDD's screen wording. Error screens no longer show a generic Suits of Madness subtitle.
- Clarified gameplay action hints, tutorial lessons, and rules summary using the GDD's terms for Single, Double, Deity Suit, Required Suit, Suit Cycle, Delegate, and redistribution.
- Updated BRIEF.md and content comments to establish the canonical GDD as the copy reference, subject to newer user decisions.

## Key technical decisions

- The canonical Google Doc is Suits of Madness GDD (suits-mp canon), document ID 1u1ipZgYhoQVu5_YwI87_LBa6fh6y5d8ePH1zm16MJro. Its old five-character Room Code and Landing name field were superseded by user requests for three-character codes and name editing in the room flow.
- The named cards in rules/cards.ts were retained because they match the GDD's card list.
- Typecheck and production build passed. Mobile screenshots of Join and Host Lobby at 390x844 were inspected; no browser console errors appeared.

## Open questions

- None.

## Known issues

- The GDD still describes the superseded code length and name-field location; BRIEF.md records the newer decisions so future copy passes do not restore them.

## Next proposed step

- Review the merged itch.io build's copy on a phone, especially error and reconnection screens that require a live network failure to reach.
