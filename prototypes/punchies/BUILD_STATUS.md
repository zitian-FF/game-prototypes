## Current milestone
Validated combat VFX and replacement pre-match VS fire, following the correction release.

## What was implemented
Directional sweet/sour sparks use a fixed eight-Graphics pool with bounded rays/flecks and shutdown cleanup. Uppercut fire follows the existing glove attachment. VS fire uses seven asymmetric layered tongues, a continuous bed and twelve drifting embers on one existing Graphics. Review harness now stops the queued boot Menu so it cannot obscure VFX proof.

## Key technical decisions
No textures, particles, VFX tweens, audio, tuning, timing or simulation changes. Integrated Art3058f40 and VFXbed5a37 on corrected main, preserving Marco cosmetic proportions and progression titles. Standard/compact inventory and content parity remain intact.

## Open questions
Physical-mobile performance benchmarking and full played two-peer Ranked KO/rematch remain outstanding.

## Known issues
Native-speaker translation review remains outstanding. Existing anonymous Elo and disconnect service limitations remain. Local Vite must restart after repacking assets to refresh its compile-time art index; release builds use a fresh index.

## Next proposed step
Deploy VFX, then merge the explicitly authorized uppercut balancing PR344 after combined validation.
