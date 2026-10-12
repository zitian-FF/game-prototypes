## Current milestone
Presentation pass from playable-ad research: stronger opening, combo feedback, hit-stop, damage numbers, danger telegraph, wave banners and a better end card. On branch `proto/punchies-playable/presentation`, stacked on `proto/punchies-playable/waves-and-hp` (PR #353, 4 HP zombies, faster cross, 50 zombie wave). Neither is merged; the live itch build is the earlier version (12 zombies, one-hit kills).

## What was implemented
- Opening: a "DEFEAT THE ZOMBIES!" call-out for about a second (states the goal), first spawn at 0.1 s and a faster first zombie (walk speed 250 rising to 340), so the first kill comes within about 2 seconds.
- Combo: consecutive sweet hits, broken by a sour hit, a miss or taking a punch. Counter in the top right plus call-outs GOOD (3), GREAT (5), AWESOME (8), UNSTOPPABLE (12), LEGENDARY (20). Visual only: scoring is unchanged. The sim tracks combo, best combo and kills deterministically.
- Feel: floating damage numbers (-2, -4, sour in orange), score pop, 45 ms hit-stop when a zombie is defeated (`view.hitStopMs`), slight purple night tint on the gym floor.
- Telegraph: a red warning triangle above a zombie that is winding up or striking (on top of the existing pulse).
- Wave banners: HORDE INCOMING at half the wave, FINAL RUSH at 80 percent.
- End card: result (TIME'S UP or OVERRUN), score, zombies defeated, best combo, a goal "Can you reach N?" (next multiple of 10), a pulsing PLAY NOW (still the no-op placeholder), and RETRY in the testing build (`PLAYABLE_RETRY`).
- Tests: new sim tests for combo build, break on sour, whiff and damage taken, spawn index; the existing wave, HP, damage and knock-off tests still pass. Browser check adds captures of the start banner, combo HUD and call-out.
- Earlier work unchanged: puppet-rig art (Marco and zombies), gym floor, 4 HP zombies with HP bars, 50 zombie paced wave, entry from 7 angles, 360 spin knock-off, red damage vignette, `?debug=1` panel.
- Built size about 1.8 MB total uncompressed, art about 0.2 MB.

## Key technical decisions
- Everything added here is presentation or derived stats; punch bands, timings, damage, HP and spawn rules were not touched by this pass.
- Combo does not multiply the score. Adding a multiplier would change the scoring rule in BRIEF.md, so it needs a decision.
- Items from the research that the brief lists as out of scope were not built: audio, a hint hand, a tutorial, a deliberate early fail, analytics events.

## Open questions
- Audio is the biggest remaining gap (the research stresses sound feedback on every hit). It is out of scope in BRIEF.md, so it needs the user's go-ahead, and it would add file size (a few short effects would be small).
- Combo multiplier or kill-based scoring: per-hit scoring still favours jabs (two jab head hits 4 points vs one cross head kill 2). Not changed without a decision.
- Sour damage is read as half (`punch.sourDamageMult`); say if it should be different.
- A hint hand on the first tap and a fake-fail opening are the other research suggestions; both need approval since a hint hand is out of scope.
- The tint, banner copy, goal text and difficulty are first guesses; check on a phone.
- The itch Fullscreen setting was handed to Codex (thread 2b50dfe7); result not yet seen. BRIEF.md now has a Presentation section and decisions 8 and 9 covering this work.

## Known issues
- Not tested on a real phone. Headless software rendering runs slowly, so the browser check waits on sim frames, not wall time.
- The 30 s end is verified by fast-forwarding the sim, not by waiting 30 real seconds.
- Hit sparks, popups, banners and the pulse are tween-driven; captures force or hold them where needed.
- Fonts fall back to Arial where Arial Black is missing.
- The purple tint is subtle on the current floor art.

## Next proposed step
1. User reviews the build and decides on audio, the combo multiplier and the hint hand.
2. Merge order: PR #353 first, then the presentation PR (it is stacked on it). Merging redeploys to the mp-console itch slot.
