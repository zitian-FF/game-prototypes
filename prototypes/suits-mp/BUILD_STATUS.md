## Current milestone

Rules modal copy updated for setup and off-suit card privacy.

## What was implemented

- Renamed the Start rules section to Setup and explained secret random Deity assignment, the 40-card deck and deal, the forced 2 of Yog-Sothoth Single opener, and clockwise play.
- Clarified that an off-suit Single appears to other players only as an unidentified face-down card until a recipient may learn it through redistribution.

## Key technical decisions

- Kept the existing accordion layout and changed only rules content. The new Setup section fits the phone viewport within the existing scroll area.
- Used the existing canonical terms Deity Suit, Lead Player, Required Suit, and Deity Card where applicable.

## Open questions

None.

## Known issues

- Local browser verification recorded one external resource request denied by the environment. After fetching and packing the current R2 asset package, the missing local card-art errors disappeared. No page exception was observed.

## Next proposed step

Continue with the next suits-mp task after this copy change reaches main and the existing itch.io deployment runs.
