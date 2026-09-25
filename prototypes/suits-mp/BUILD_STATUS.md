## Current milestone

Lobby names, randomized seating, and aspect-safe game art are implemented.

## What was implemented

- Moved name entry off the landing screen. The host edits their own name in the room lobby; a joiner enters it with the code and can edit it while waiting. Other roster entries are read only.
- On Start Game, the host requests each peer's final name, collects replies for up to three seconds, locks blank-name labels, and shuffles the four game slots before dealing. Single Player seating is shuffled too.
- Canvas images and card layers now fit their boxes with uniform scale. Intentional card squash flips became fades. Existing nine-slice assets retain their segmented resizing.
- Updated the brief for lobby names and shuffled seats.

## Key technical decisions

- Lobby roster rows keep join order for bot controls. The game slot shuffle happens once after final names are collected, so turn order and seats vary while player identities stay stable.
- Name replies are accepted only for a matching request ID, client ID, and current peer ID. A missing reply retains the latest name received at join or edit time.
- Typecheck and production build passed. Browser screenshots of join, host, and game layouts at 390x844 were inspected; no browser errors appeared. A host-plus-three-bots game showed non-sequential player labels around the table.

## Open questions

- None.

## Known issues

- A live four-device name collection was not verified in this session; the room signaling service is external.
- This prototype's identity handshake uses a persistent client ID rather than authenticated accounts, so it does not protect against deliberate client ID spoofing.

## Next proposed step

- Human review the merged itch.io build on separate devices, including a name edit immediately before Start Game.
