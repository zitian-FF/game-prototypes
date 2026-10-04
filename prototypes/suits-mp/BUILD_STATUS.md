## Current milestone

Redistribution now has a visible card flight before the next turn begins locally.

## What was implemented

- At the end of redistribution, cards travel from the redistributor's play area to each recipient's play area.
- Cards received by the local player appear face up, pause briefly, then move into their hand. Other recipients' cards stay face down.
- The latest host state is held for presentation until the local animation finishes; game rules and network turns continue normally.

## Key technical decisions

- The animation derives recipient counts from the completed trick and face identities only from the viewer's masked redistribution log. It does not reveal another player's cards.
- Travel timing reuses the existing card collection tuning; the face-up pause has its own tune.json value.
- Typecheck and production build passed. The local browser rendered the tutorial board with no console errors. The redistribution sequence itself awaits human review on the merged itch.io build.

## Open questions

- None.

## Known issues

- The redistribution animation has not yet been visually reviewed during a completed round in the browser.

## Next proposed step

- Review the card paths and face-up pause on the merged itch.io phone build.
