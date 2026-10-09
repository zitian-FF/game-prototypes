## Current milestone
Implement completed outsource artwork, stacked on runtime palette PR #279.
## What was implemented
Longan joins the locked fighter pool with a cleaned portrait and layered wrapped-fist rig. McClassic joins Marco's unique skin pool with a helmet-free portrait and green/black rig. Existing training dummy portrait remains integrated. Updated roster portrait size, victory quote, English labels and tuner metadata.
## Key technical decisions
Longan uses Marco's current stats provisionally; McClassic remains cosmetic. Register Longan overhead head/torso/feet facing right. Use the cleaned preferred Longan left foot and McClassic right boot, generating opposite parts through exact mirrors; shipped opposites derive at runtime. R2 archive adds 26 entries and preserves every previous entry byte for byte. Verified public SHA256 cb2f8cd3ca36c34d1b6ee2cbf6846ca2dbf163006fb97d991b66b8db031a9b73.
## Open questions
Longan's final stats await user tuning.
## Known issues
Not merged or deployed. Minute original matte RGB may remain within preserved antialiased boundaries. Existing Vite locale/chunk warnings remain.
## Next proposed step
Review and merge the stacked changes. Typecheck/build, roster/palette/asset regressions and Brave production rig/portrait checks pass.
