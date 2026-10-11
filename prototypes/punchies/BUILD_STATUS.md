## Current milestone
Complete Main-approved bug/performance batch validated against live147.

## What was implemented
Survival creates all dynamic rigs inside the ring world and uses the visible glove path for contact without expanding hitboxes. Neutral facing reacquires on completed-action ticks. Zombies spawn with a fade and fly in the immutable final-hit direction to an inset red rope before fading; at most 24 reused views. Music queues the selected track and retries on initial readiness, capture-phase gestures and shared audio-context unlock. FIGHT completes its entrance before fade/input unlock using shared deterministic simulation timing. VS fire uses a cached 16-frame runtime atlas; hit text uses 20 reused objects. Fighter identity owns roster clash animation; bounded material masks, shade memo and shared alpha bounds reduce palette work while preserving pixels.

## Key technical decisions
Integrated Logic/VFX86cc07a and Artbebd1c1 on latest main, preserving approved tune values, Ranked Elo and Profile. No new download assets/R2/Worker changes. Verified all 2069 source files against published standard ZIP and freshly downloaded compact hashes. Both profiles default CrazyGames. Packages: standard17315301 bytes (+6784), compact10093454 bytes (+6784) versus live147; 40MB/20MB budgets and parity pass. Cached fire adds3.52MiB runtime RGBA memory, not download assets.

## Open questions
Physical Android spark disappearance is unreproduced. Physical mobile performance, full played Ranked KO/rematch and native-speaker translation review remain unverified.

## Known issues
Desktop controlled profiling shows lower roster stalls and bounded VFX churn; no mobile60fps or broad frame-rate-fix claim. Cold palette upload can still exceed a frame. Browser autoplay may require a valid first gesture; saved mute/volume are preserved. Music signal/playback evidence is instrumented, not subjective listening.

## Next proposed step
Merge and deploy this complete batch, verify live flows, then obtain physical Android reproduction/performance evidence.
