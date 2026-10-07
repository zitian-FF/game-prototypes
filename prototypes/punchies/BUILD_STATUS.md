## Current milestone
Approved match presentation and best-of-three shipped as r0076 (PR #239).

## What was implemented
Bo3 (first to two wins) is the default for solo, local and online play; Bo1 is selectable. Between rounds the arena crossfades through the Punchies logo stamp splash, then displays ROUND N and FIGHT. Round-win pips track the score. Final results contain only a compact headline and Rematch, Change Boxer and Main Menu buttons. All boxer and dummy rendering is 150% of its previous size; combat and KO camera shake strength is halved.

## Key technical decisions
Fresh simulation and AI/rollback instances reset positions and combat resources each round while carrying an immutable series score. Draws replay without a win. Online readiness uses the existing round epoch handshake and ignores duplicate readiness; character reselection preserves epoch progression. Disconnect/leave cancels a pending splash. Guest host-tune restoration survives reselection. Hitboxes, reach and combat timing are unchanged. New values are exposed through tune.json and tune.meta.json.

## Open questions
None. The larger visual bodies can overlap sooner than the unchanged collision bodies; this was raised to the user as a presentation tradeoff.

## Known issues
Physical two-device online, phone and controller checks remain pending. The existing Phaser bundle size warning remains.

## Next proposed step
Typecheck and build pass. Series tests cover sweeps, deciders, draws, Bo1, fresh resources, intro freeze and online early/late/duplicate readiness and rematch reset. Canvas/WebGL camera-effects regression passes. Brave review verified round carryover, splash, numbered announcement, minimal result, rematch and enlarged dummy with clean consoles. Deployment succeeded. Live Brave review confirms r0076, the default BEST OF 3 selector and clean console. Continue physical two-device online and phone/controller testing.
