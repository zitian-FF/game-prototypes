## Current milestone
Generated sound effects, on request (the brief's audio limit was lifted by the user on 2026-10-12). On branch `proto/punchies-playable/audio`, stacked on `proto/punchies-playable/presentation` (PR #354), which is stacked on `proto/punchies-playable/waves-and-hp` (PR #353). None of the three is merged; the live itch build is the earlier version (12 zombies, one-hit kills, no sound).

## What was implemented
- 16 generated sounds, synthesised with Web Audio when they play (oscillators, filtered noise, short envelopes): jab and cross whoosh, head hit, body hit, defeat, sour thud, player hurt, four combo chimes, horde and final-rush rumble, opening ping, win and lose jingles, UI tick. No audio files, no dependency, no added download.
- Wired to the game: a whoosh on every punch start (new `punch` sim event), hit sound by outcome, defeat sound, sour thud, hurt sound, combo chime on each call-out, horde sound on the two banners, opening ping, end jingle, UI tick on PLAY NOW, RETRY and the mute toggle.
- Browsers block sound before a user gesture, so the AudioContext is created on the first tap or key press. Sound pauses while the page is hidden. A cap of 16 simultaneous voices keeps busy waves light.
- Mute: a small speaker toggle top left under the HP gloves, `?mute=1` starts muted, not saved between visits. Master volume `audio.master` (0.7) is in tune.json and the debug panel.
- Verification without speakers: the browser check renders every sound offline and requires real signal (peak 0.05 to 0.95, nonzero level, no NaN). This caught `hit_head` clipping (peak 1.11), now fixed. It also checks that tapping JAB plays the whoosh then the head-hit sound, that a cross defeat plays the defeat sound, that taking a punch plays the hurt sound, and the mute toggle and `?mute=1`. Sim test: one `punch` event per punch start, including a buffered punch.
- Earlier work unchanged: puppet-rig art, gym floor, 4 HP zombies and HP bars, 50 zombie paced wave, combo and call-outs, damage numbers, hit-stop, danger marker, banners, end card with RETRY (testing build), `?debug=1` panel.
- Built size about 1.8 MB total uncompressed (sound adds a few KB of code, no files).

## Key technical decisions
- Generated in code rather than recorded files: zero download, easy to tune, and nothing to license. The trade-off is that synthesised effects sound simpler than recorded ones; swapping in recorded clips later would only change `src/audio.ts`.
- Sound is presentation only. The sim's only change is the `punch` event, which does not alter any rule.
- Mute is memory only (no localStorage), keeping the "no persistence" exception.

## Open questions
- I cannot hear the sounds. A preview WAV of all 16 in play order was rendered for the user to listen to (kept outside the repo); the levels and character (for example the kill thump, combo chimes) are first guesses to adjust by ear. Master volume is in the debug panel.
- Music is not included (BRIEF.md still lists music and recorded audio as out of scope). A short looping track would be the next audio step if wanted, at some download cost.
- Combo multiplier or kill-based scoring: per-hit scoring still favours jabs (two jab head hits 4 points vs one cross head kill 2). Not changed without a decision.
- Sour damage is read as half (`punch.sourDamageMult`); say if it should be different.
- A hint hand and a fake-fail opening (other research suggestions) remain out of scope until approved.
- The itch Fullscreen setting was handed to Codex (thread 2b50dfe7); result not yet seen.

## Known issues
- Not tested on a real phone, and the sounds have not been heard on a real device (iOS Safari in particular needs the first tap to start audio, which is how it is built, but this is untested on iOS).
- Headless software rendering runs slowly, so the browser check waits on sim frames, not wall time. The 30 s end is verified by fast-forwarding the sim.
- Hit sparks, popups, banners and the pulse are tween-driven; captures force or hold them where needed.
- Fonts fall back to Arial where Arial Black is missing.

## Next proposed step
1. User listens to the preview WAV and the build, and adjusts the mix (or asks for music).
2. Decisions on the combo multiplier, sour damage and the hint hand.
3. Merge order: PR #353, then #354, then the audio PR. Merging redeploys to the mp-console itch slot.
