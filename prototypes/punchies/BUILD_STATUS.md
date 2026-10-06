## Current milestone
Vulnerable-state cue and reference panel cleanup.

## What was implemented
- Vulnerable state (punch startup/recovery, guard release, dodge tail, stunned, exhausted): the whole boxer silhouette (head, torso, gloves, boots, arms) pulses red-orange for as long as the state lasts. Speed and strength are tune values (`view.puppet.vulnerablePulseMs`, `vulnerablePulseMax`) with sliders. Hit flashes still override it. Puppet art only.
- Reference panel (info): removed the Late Sour column, updated the body-hit row (no defender stamina loss) and the sour legend (early contact only).
- Menu credits and demo notice were added in the previous pass (bottom left of the main menu).

## Key technical decisions
- Pulse uses a multiplicative tint, so light parts (skin, highlights) show it strongest and dark blue/green parts less so; raise `vulnerablePulseMax` if it reads too weak on a character.
- Presentation only; sim untouched.

## Open questions
- Should the older layered-art and drawn fallbacks (used only if parts fail to load) also pulse? Not done.
- The hub page (index.html) has no demo notice.

## Known issues
- Not verified on a real phone.
- Bot spacing still needs a retune after the range changes.
- Sweet/sour timing has no on-screen cue now that the glove ring is gone.

## Next proposed step
Playtest the pulse strength on all three characters, then retune bot spacing.
