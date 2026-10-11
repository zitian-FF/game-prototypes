## Current milestone
Recalibrated roster stat display approved for live release.
## What was implemented
Five Base-relative bars: Durability, Endurance, Speed, Power and Reach. Fixed piecewise ranges place Base at 60% fill and amplify small differences. Durability combines 70% HP and 30% stun threshold; Endurance combines stamina capacity, regeneration and ordinary-punch efficiency. Speed uses movement and full ordinary-punch cycles; Power and Reach exclude uppercuts. Bars show exact rounded Base-relative percentages. Separate lines show actual HP/stun threshold and uppercut stars/HP damage. All six languages include the new labels and matching placeholders.
## Key technical decisions
Display only: no combat tuning changes. Compare against neutral Base, including unit body proportions, never Marco. Stable ranges do not depend on roster min/max. Uppercuts are separate because per-fighter charge costs make their raw averages misleading. Keep portrait and details inside the selection panel.
## Open questions
Human playtesting should review readability across screen sizes and languages.
## Known issues
Existing machine-translated copy is not native-reviewed. Compact delivery retains its mandatory 10 MB gate.
## Next proposed step
Verify live deployment and review the recalibrated roster in-game.
