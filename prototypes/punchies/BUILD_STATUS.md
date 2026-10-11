## Current milestone
Validated combat VFX, replacement pre-match VS fire and owner-approved uppercut balancing PR344.

## What was implemented
Directional sweet/sour sparks use a fixed eight-Graphics pool with bounded rays/flecks and shutdown cleanup. Uppercut fire follows the existing glove attachment. VS fire uses seven asymmetric layered tongues, a continuous bed and twelve drifting embers on one existing Graphics. Review harness stops queued boot Menu so it cannot obscure proof. Uppercut damage targets: Longan 6; Mia 16, Tee 18, Captain 17, Nadia 15; Marco 31, Bruno 34, Dragon 29, Roxy 35; Tyke 48. Roster details show stars required and retain five stat bars.

## Key technical decisions
VFX adds no textures, particles, tweens, audio or gameplay/timing changes. Balancing changes only owner-approved uppercut damage multipliers and Tyke metadata range; other tuning remains. Integrated Art3058f40 and VFXbed5a37 on corrected main, preserving Marco cosmetic proportions and progression titles. Standard/compact inventory and content parity remain intact.

## Open questions
Physical-mobile performance benchmarking and full played two-peer Ranked KO/rematch remain outstanding.

## Known issues
Native-speaker translation review remains outstanding. Existing anonymous Elo and disconnect service limitations remain. Local Vite must restart after repacking assets to refresh its compile-time art index; release builds use a fresh index.

## Next proposed step
Merge and deploy validated balancing PR344, then playtest the experimental uppercut curve.

