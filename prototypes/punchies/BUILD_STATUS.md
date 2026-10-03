## Current milestone

Training, tutorial, single player, local VS and online 1v1 PvP are all
playable and deployed to the Current WIP itch.io slot. Online now uses
rollback netcode instead of lockstep. Online was verified end-to-end in-browser over a
mock transport only; the real Nostr/WebRTC path is untested (see Known
issues).

## What was implemented

- (Branch, not merged yet.) Characters + character select (BRIEF
  "Characters"): `sim/character.ts` (per-fighter stat lookups, punch
  config with reach / frame / fatigue overrides), `tune.characters` with
  debug-panel entries under a new Characters category, `CharSelectScene`
  (touch, keyboard, controller; vsai / localvs / online flows),
  `sim/charPrefs.ts`, Training character toggle, character names in the
  fight HUD. Punch reach is stored on the punch when thrown. Online:
  'pick' control message, 'start' carries [host, guest] character ids;
  rollback creates the sim with them; rematch keeps them.
  Verified: headless stat table matches the spec; Mia vs Bruno rollback
  3000 frames, 0 hash mismatches; Playwright select screen (touch +
  keyboard into VsAI), and two-tab mock online pick -> match with both
  sides showing MIA vs MARCO.

- (Branch, not merged yet.) Uppercut can now be Perfect Guarded (High
  Guard still can't block it); BRIEF + info panel updated. Pushback now
  locks the defender's own walking for its duration (dodge still works),
  so holding forward can't cancel knockback. Headless: PG stops the
  uppercut, held High Guard / no guard take 20; push identical standing
  still vs holding forward.

- (Branch, not merged yet.) Keyboard / controller menu navigation
  (`ui/menuNav.ts`): every button registers; arrows / WASD / D-pad /
  left stick move a pulsing yellow highlight, Enter / Space / A press.
  Modals (input popup, join keypad, tutorial end) trap the highlight.
  In fights it's off until Esc / Start (fight input is muted while it's
  on) and turns on by itself for result screens. Window-level key
  listener, so no keys are lost before the canvas has focus.
- Boxer look: 🥊-style gloves 15% bigger (round mitt, thumb lobe, knuckle
  shine, white laced cuff), skin-tone arms (the red boxer read as a crab),
  rest / guard glove spacing widened to match. Render only; hitboxes
  unchanged.

- (Branch, not merged yet.) 2026-10-03 batch:
  - Ring art: canvas weave + scuffs + centre mark, three ropes with tape
    wraps, corner posts (blue P1 / red P2 / two neutral). Cached, redrawn
    only if ring bounds change.
  - Keyboard/controller HUD row under the player's name: star pips and
    J/C/H fatigue pips (touch players still see them on the buttons;
    Local VS shows it for each non-touch player).
  - Whiffs no longer reset stars (uppercut whiff still spends them).
  - Tune (user-requested): pushHit/pushBlock x1.5, all stunBuild values
    (punches + perfectGuardStunBuild) x1.25, perfectGuardAttackerStunFrames
    45 -> 56, dodge.speed 225 -> 337.5 (+50% distance).

- (Branch, not merged yet.) Pushback on contact: the defender slides
  back along the punch over `hit.pushFrames` (6) ticks, hooks angled
  toward the side they came from; per punch `pushHit` / `pushBlock`
  (jab 2/0, cross 10/5, hook 8/4, uppercut 16/-). Anchored training
  dummy doesn't move. Headless-verified distances. User-requested tune
  changes: `dodge.speed` 150 -> 225 (same 14 frames, ~50% further),
  `stamina.exhaustRecoverAt` 25 -> 20.
- Boxer graphics: gloves (player colour, phase colours while punching /
  guarding), arms, muted torso with player-colour outline, sparring
  helmet, stepping leg shadows. Bigger, pop-in damage numbers above the
  defender. KO poses match.

- (Branch only, not merged yet.) KO animation (`render/KoAnim.ts`),
  render-only. The sim records each fighter's last damaging blow
  (`lastBlow`) and puts the KO style + direction in `result.ko`
  (`koStyle()`: Uppercut or sweet Cross/Hook = fly, else drop). Drop:
  body flattens into an ellipse along the blow, head slides back, fists
  splay, colour greys, dust ring. Fly: slow-mo flight with spin and ghost
  trail to the ropes (capped at `ko.flyMaxDistance`), rope flash + bulge +
  camera shake, then a sitting slump facing centre with stun stars. The
  winner's punch recovery replays at `ko.slowmo`. The result screen waits
  for the animation (+`ko.resultDelayMs`). Online starts it only once the
  KO is confirmed. Training plays it too; the dummy stays down until
  RESET. New KO tune category (6 values).
  Verified: headless style rules (jab/sour/chip = drop, sweet
  cross/hook + uppercut = fly), Playwright captures of both styles in
  Training and the single-player result screen appearing after the
  animation; no console errors.
- Rollback netcode (`net/rollback.ts`, replaces `net/lockstep.ts`):
  fixed local input delay `net.inputDelayFrames` (2); the opponent's
  input is predicted (held stick/guard carry over, taps don't); per-tick
  snapshots; a late input that contradicts the prediction restores the
  snapshot and re-simulates to now; effects already shown are not
  replayed; stall only past `net.maxRollbackFrames` (12); result only
  shown once confirmed. GGPO-style time sync: the peer that runs ahead
  of the other skips at most one tick in ten until both meet (was one in
  three, which felt sluggish on phones).
- KO bell: three "ding" strikes (synthesised bell partials) on KO.
- Tutorial mode
  (`TutorialScene`, TUTORIAL button next to TRAINING): 17 linear steps
  (basics, defense, resources, advanced), one instruction each, device-
  aware button names, controls/HUD revealed step by step, scripted dummy
  per step (idle / jabber / crossBait / whiffer), completes on the actual
  action, SKIP/EXIT, progress saved in `punchies:tutorial:v1`, end screen.
  Playwright: step 1 reveal + completion by walking, step 14 reveal, end
  screen clears progress.
- Subtle yellow pulse on a boxer while the dash buff is armed or the
  Uppercut is charged (replaces the orange ring). Not visually confirmed
  in headless captures.

- Per-type fatigue: `punches.<type>.fatigueBars` (jab 4, hook 3, cross 2)
  with per-bar speed/damage penalties sized so full bars all give the
  same max penalty (x1.48 frames, 60% dmg). Decay pause
  (`fatigue.decayDelayFrames`, 60): a type only recovers after not being
  thrown for a while. Fixes Cross (and partly Hook) never fatiguing under
  flat decay. Grey "tired" text on fatigued throws. Headless: 8 whiffed
  repeats fill jab 4/4, hook 3/3, cross 2/2; tired from the 4th.

- Keyboard + controller support (`input/devices.ts`): two fixed keyboard
  layouts (WASD / arrows+numpad) and standard-gamepad mapping, polled
  per frame so taps between ticks aren't lost. Solo modes merge touch +
  all keys + all pads. Touch controls hide after key/pad use and return
  on the next touch.
- Local VS mode (`LocalVsScene`) with INPUT popup next to the menu button
  (per-player device, no sharing, touch P1-only), saved in localStorage
  `punchies:localInputs:v1`. Neutral hit feedback (no "me").
  Playwright: popup cycling + save, keyboard single player (touch hidden),
  local VS with a fake injected gamepad (RB raised P2's guard).

- READY... GO! intro (`match.introSec`, 2 s) for Single Player and Online:
  in the sim, so both online peers start together; no input until GO,
  round timer starts at GO. Headless-tested (no movement during intro,
  GO at tick 120, netcode and AI tests unchanged).

- Single Player vs easy AI (`sim/ai.ts`, `VsAIScene`): reads sim state and
  emits FrameInputs like a player; delayed reactions (`ai.reactionFrames`
  10), guards/dodges some punch starts, approaches / retreats on low
  stamina, picks jab/cross/hook by weights, uppercuts at 3 stars. Knobs in
  the new AI tune category. Headless: KOs an idle player in ~25 s; AI vs
  AI ends by KO in ~22 s with some perfect guards.
- Dash buff: a punch within `dodge.buffWindowFrames` (18) after a dodge
  ends does `dodge.buffDamageMult` (1.5x); orange glow while armed,
  POWER! label on hit. Headless: jab 4 -> 6 inside the window, 4 after.
- Optional hit-stop in the sim (`hit.hitstopFrames`, default 0 = off;
  counters x2). Presses during it stay buffered; online stays in sync
  (loopback test with 3f hit-stop: no desync).
- Hit feedback split by local perspective: directional spark cone along
  the strike (bigger for counters/uppercut); landing = white/yellow +
  opponent white flash + light shake; taking = orange/red + red screen
  edges + strong shake + vibrate + low hurt sound; COUNTER! / PUNISHED!
  callouts that shake as they fade; damage numbers.

- Tune: `tune.meta.json` (category, description, range for all values);
  debug panel grouped by category > section with ranges, "was" values and
  per-value reset; SYNC TUNE button on the main menu (session-only fetch
  from GitHub raw, validated per value, falls back to built-in); guest
  adopts host tune for a match and restores its own after. New tunables:
  `match.startDistance`, `guard.perfectCooldownFrames`.
- Perfect Guard anti-mash: PG window only if guard was down >= 20 frames
  (headless-tested: re-raise after 5f blocks, after 25f perfect-guards).
- Full-screen "i" reference overlay with tables (frame data, hit table,
  legend, vulnerable, defense); HITBOXES toggle inside it; touch controls
  disabled while it's open; game keeps running.
- Fullscreen button (menu + fights): Fullscreen API on Android/iPad (+
  landscape lock), Add-to-Home-Screen hint on iPhone; iOS web-app metas.

- Deterministic 60 Hz fight sim (`src/sim/`): punch phases (startup, early
  sour with the fist travelling out, sweet at full extension, late sour,
  recovery + per-punch whiff recovery), full hit table, counters, startup
  interrupt, Perfect Guard, High Guard, dodge, stars/uppercut, stamina,
  stun, fatigue, KO, 99 s timer with health-% decision / draw.
- Core = face: in Normal stance a hit reaching the core uses the
  Vulnerable row, outer ring uses the Normal row. Vulnerable stance: all
  hits on the Vulnerable row.
- Vulnerable windows: punch startup + recovery (incl. whiff), dodge tail +
  post-dodge window, stunned, 0 stamina. Active frames are not vulnerable.
- Low stamina: hitting 0 makes you Vulnerable until stamina regens to
  `exhaustRecoverAt` (30), at `exhaustedRegenMult` (0.35x) speed: about
  6 s idle vs 2 s normally. No crit on Vulnerable; guest view unmirrored
  (all confirmed by user, BRIEF.md updated).
- Hook: close-range tool (startReachFrac 0.75, 1 early-sour frame) and
  chips `guardChipMult` (40%) of its hit through High Guard.
- Training: dummy stance cycle (Normal / High Guard / Vulnerable), no HP
  refill until RESET, MENU button.
- "i" info panel: hitbox overlay + frame data + hit table, no pause.
- Online (`src/net/`, `MenuScene`, `LobbyScene`, `MatchScene`): Trystero
  (Nostr, pinned relays) + mp-net's TURN worker; 3-char room codes; host
  shows code + QR (`?room=CODE` URL); host measures ping and picks input
  delay; tune synced host -> guest at start; redundant input packets; 1 Hz state-hash desync check; "waiting for opponent" indicator;
  result screen with REMATCH / MENU; disconnect handling; full-room and
  code-collision handling.
- Square 310x310 ring, responsive view, auto-rotate to landscape,
  in-canvas touch controls + HUD, WebAudio placeholder sounds, Tweakpane
  (?debug=1), version stamp.

## Key technical decisions

- Rollback over lockstep: the user saw freezes on mobile data. Headless
  network sim (60 s, 2 seeds, guest joins 0.5 s late): Wi-Fi ~0% stalls,
  avg rollback 1 frame; mobile profile (jitter + 400 ms dropouts) 2-3%
  stalls vs 8-9% for the old lockstep at delay 8, avg rollback ~3.7
  frames; 0 hash mismatches. Remaining stalls are dropouts longer than
  the 12-frame window. Worst-case 11-frame rollback costs ~0.3 ms.
- Lobby delay = max(`net.inputDelayFrames`, one-way ping in frames -
  `net.maxRollbackFrames` + 1), so very high ping adds delay instead of
  stalling constantly.
- Rollback core has no Phaser dependency and was tested headless.
- Host = fighter 0 (left), guest = fighter 1 (right); no screen mirroring.
- Hit resolution: the fist passes through the outer ring and resolves when
  it touches the core or reaches full extension; that frame sets
  sweet/sour, touching the core sets the row.
- The Nostr room id is `room-<CODE>` under appId `punchies`.
- Shared stage (`scenes/FightStage.ts`) used by Training and Match.
- QR code uses the page's own URL. On itch.io that's the itch CDN iframe
  URL (html-classic.itch.zone/...), which opens the game directly.

## Open questions

- BRIEF.md had "extra characters" out of scope; the user moved it into
  scope (2026-10-03). BRIEF updated with the character spec.

- Hook chip vs "absorbed by normal guard": implemented as Hook chips only
  High Guard; vs Normal stance it follows the regular table. BRIEF.md
  updated; confirm.

## Known issues

- Real controllers untested (only a JS-injected fake gamepad). Menus are
  touch/mouse only; no controller/keyboard menu navigation yet.

- The ~0.2 s spark itself wasn't caught mid-flight in Playwright captures;
  PUNISHED!, red edges, damage numbers and body flashes were.
- Vibration is Android-only (iOS Safari has no web vibration).

- SYNC TUNE could not reach GitHub from the build sandbox; its logic was
  tested in Node with a mocked response (partial, wrong-type, broken
  JSON). First real sync is untested.
- Fullscreen and Add to Home Screen untested on real iOS/Android devices.
- The debug panel is 420px wide and covers half a landscape phone when
  expanded.

- Real online play (Nostr relays + WebRTC + TURN) could not be tested from
  the build sandbox (outbound relay traffic blocked). Verified instead:
  headless rollback sim, and two browser tabs over a BroadcastChannel mock
  of Trystero (lobby, QR, ?room join, ping/delay, match start in sync, no
  desync). The two headless tabs only reach ~14 fps each in the sandbox,
  so real-speed play in the browser was not observed. Rematch
  flow not exercised in any test.
- Info panel overlaps the left edge of the ring on narrow views.
- All tune numbers are first-pass; only the ones the user asked for were
  changed deliberately.
- Rotation fallback patches Phaser internals; recheck on Phaser upgrades.

## Next proposed step

Real two-phone online test on mobile data. If it still freezes, raise
`net.maxRollbackFrames` (e.g. 20) in ?debug=1; if corrections look too
jumpy, raise `net.inputDelayFrames` to 3-4.
