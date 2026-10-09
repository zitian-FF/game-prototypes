# Punchies - BRIEF

Top-down 2D boxing game for mobile landscape with touch controls. Online
1v1 PvP (rollback netcode over the repo's Trystero networking) plus a training
dummy for solo testing. This file combines the original handoff with the
decisions made in the planning round (2026-09-29).

## Scope
- Title presentation (approved 2026-10-06): outlined cartoon gym with a
  reusable, separately layered ring. Single Player is primary; Local VS and
  Online sit under Versus; Training and Tutorial under Practice. Settings
  retains local input setup, Online offers Host / Join, Credits opens a
  dedicated panel. Remove the demo notice. Title logo gently pulses;
  loading screens stamp the logo and continuously wrap a subdued logo
  pattern across the background. Screen changes use a subtle crossfade.
  Honour reduced-motion preferences. Keep all existing debug controls.
- Approved presentation follow-ups, not part of the title pass: improve
  character select, sweet/vulnerable and face/body feedback; collapsed KO
  art with brushstroke KNOCK then OUT impacts and three bell strikes;
  brief arena-only shake on landed uppercuts and counter/punish hits.
- Local VS: two players on one screen, each on their own input device
  (added 2026-09-30); an INPUT button next to it picks devices.
- Online 1v1 PvP, plus Single Player vs an easy AI (added 2026-09-30 at
  the user's request; previously out of scope).
- Training dummy: static, toggle between idle and holding High Guard. A padded head and torso are separate overhead sprites; the neck attaches beneath the head. Two wooden gloves and articulated wooden arms animate between Normal, High Guard and lowered Vulnerable poses. The struck part shakes briefly and independently. HP stays at zero without ending training, refilling automatically, or playing KO sounds; hits continue and manual RESET remains available (updated 2026-10-06). Hitboxes and stance rules remain unchanged.
- Three characters (orthodox stance), added 2026-10-03 at the user's
  request (see Characters).
- Single Player bot levels Easy / Medium / Hard (added 2026-10-03 at the
  user's request; scripted, see Bots).
- Out of scope: progression, cosmetics, signature moves (planned next as
  "option C"), southpaw.

## Bots
Scripted, local-only (never online), they only emit FrameInputs and see
the foe `reactionFrames` late. Level is picked on the character select
screen under the AI label (tap, Up / Down, or D-pad up / down) and
remembered. Easy = the original bot (`sim/ai.ts`). Medium and Hard
(`sim/bot.ts`, numbers in `tune.ai.medium` / `tune.ai.hard`): spacing from
each punch's real range, punish exposed foes (recovery, exhausted,
stunned), fatigue-aware punch choice, uppercut when charged, ring
awareness. Hard adds timed Perfect Guards, uppercut dodging, jab
interrupts into slow wind-ups and a faster reaction (5 frames vs 7 / 10).
A bot decides once per incoming punch whether to try a Perfect Guard,
sometimes mistimes it (raised early = plain block) and then pauses before
attacking, so it is not an unbeatable wall (Hard Perfect Guards about 4%
of punches thrown at it, roughly once a minute).
Headless ladder (Marco mirror, 40 matches, seats swapped): Medium beats
Easy 65%, Hard beats Easy 85%, Hard beats Medium 80%.

## Characters
Stat archetypes on top of the shared tune (`tune.characters.<id>`):
multipliers for max HP, max stamina, stamina regen, stun threshold, walk
speed, and per punch (J/C/H/U) damage, stamina cost, stun build, pushback
and reach; frame deltas (max +-2) for startup and recovery; extra fatigue
bars (penalty per bar shrinks so the maximum penalty stays the same).
Global for everyone (no learning curve): sweet/sour windows, hit table,
core/outer ring, hurtbox, Perfect / High Guard, dodge, stars, counters,
fatigue rules, hit-stop, timer, ring.
- Marco Reyes "The Metronome": steady all-rounder. Stamina 1.1, regen
  1.1, stun 1.05, Cross damage +10%.
- Mia Tanaka "Flicker": fast hands and feet, shorter reach. HP 0.85,
  stamina 1.1, regen 1.15, stun 0.9, speed 1.15; Jab startup -1 recovery
  -2, Cross damage -10% startup -1, Hook stamina cost -15% startup -1
  recovery -2; all reach 0.9.
- Bruno Kowalski "Brick": tough and heavy-handed, slow. HP 1.2, stamina
  0.95, regen 0.9, stun 1.25, speed 0.88; Cross / Hook damage +15%,
  startup +1, recovery +2; Cross / Uppercut push 1.25; +1 fatigue bar on
  Jab / Cross / Hook.
Looks (render only; hurtboxes and reach unchanged): Marco blue / alt
cyan; Mia red / alt pink, smaller frame (0.88), yellow ponytail; Bruno
green / alt lime, larger frame (1.12). In a mirror match P2 wears the alt
colour. Corner posts take each player's colour. "P1" / "P2" tags float
over the boxers from the start and fade out `match.tagSec` (8) seconds
after GO.
Character select: two panels (preview, name, nickname, style line, six
stat bars with base tune at 80%: HP, Stamina, Stun resist, Speed, Power
= mean J/C/H damage, Hand speed = J/C/H startup+recovery frames) and
three cards in the middle. Single Player: the player picks theirs and the
AI's. Local VS: each side on its own device. Online: each phone picks its
own; the opponent shows "picking..." / READY; the host starts. Training
has a YOU: <name> toggle; the tutorial uses Marco. Picks remembered in
localStorage `punchies:chars:v1`.

## Controls (landscape, MOBA-style)
- Left: floating virtual joystick for movement. Boxer always faces the
  opponent.
- Right: main button split in two halves (left = Jab, right = Cross; each
  tap fires exactly the half touched), with arc buttons:
  - Hook: one button, alternates left/right automatically (cosmetic). The
    close-range tool: short reach but almost no jammed (early sour)
    window, and it chips damage through High Guard (anti-turtle). A
    Perfect Guard still negates it.
  - Guard: hold for High Guard.
  - Dodge: direction from joystick; neutral stick = backstep.
  - Uppercut: dedicated button that doubles as the Star Power meter.

## Keyboard / controller (fixed layouts)
- Keys (left): WASD move, J jab, K cross, L hook, I uppercut, Space dodge,
  Shift hold guard.
- Keys (right): Arrows move, Numpad 1/2/3 jab/cross/hook, 5 uppercut,
  0 dodge, Numpad Enter hold guard.
- Controller: left stick / D-pad move, X jab, Y cross, B hook, A dodge,
  RB/RT hold guard, LB/LT uppercut.
- On-screen touch controls hide once a key or controller is used and come
  back on the next screen touch.

## Punch frames
Startup -> Early Sour (active, fist extending) -> Sweet (active, full
extension) -> Recovery. Late Sour is no longer used (0 frames for every
punch, 2026-10-06): a hit resolves on the first frame the fist is in range
at full extension, so a late sour practically never happened. Active frames
are continuous (no gaps). The fist travels outward during Early Sour; touching the outer
hurtbox doesn't stop it, and the hit resolves when the fist reaches the
core or full extension. The resolving frame decides sweet vs sour; whether
it reached the core decides the Normal vs Vulnerable row. A whiff adds
per-punch whiff recovery frames (punish window). All frame data, reach, damage
and stamina cost live in tune.json. Jab fastest/lightest/long reach; Cross
slowest/heaviest/long reach; Hook medium speed, moderate damage, shorter
reach.

Ranges (2026-10-06, centre distance in px, defender standing still; fighters
cannot stand closer than 44): the Jab reaches 70 (reach 42, radius 6) and
its far body band ends where the Cross face band begins, so it is the range
gauge. Cross reaches 85 (56 / 7): sour inside 70, sweet face 70-78, sweet
body 78-85. Hook and Uppercut reach 65 (31 / 12), slightly under the Jab.
Core (face) radius is 15. Early contact before full extension is sour.

## Defensive states
- Normal: idle/moving. Circle hurtbox with a smaller core inside it. The
  core is the FACE: a hit that reaches it uses the Vulnerable row (full
  damage on sweet); a hit that only reaches the outer ring (arms/body) uses
  the Normal row. (Changed 2026-09-29: the original handoff described the
  core as a reduced-damage zone.)
- Vulnerable: punch startup and recovery (including whiff recovery; not
  the active frames), guard-release penalty, dodge tail + post-dodge window, stunned, empty
  stamina. Core removed, hurtbox enlarged; every hit uses the Vulnerable
  row.
- High Guard: blocks, drains stamina while held. Zero damage always.
- Perfect Guard: hit lands within the first few frames of Guard. Applies
  to sweet and sour hits. Defender recovers stamina; attacker stunned.
  Every legal guard raise starts a tight 3-frame Perfect Guard window;
  there is no separate perfect-guard cooldown. Lowering an active guard
  starts a 24-frame guard penalty (400 ms at 60 Hz): Vulnerable, full
  damage on sweet hits, and guard cannot be raised until it ends. Punch
  and dodge cancels also lower guard and keep this penalty. Holding the
  guard input during the penalty raises it only once guarding is legal.
  The penalty adds no movement slowdown or attack/dodge lockout.
  Counter (2026-10-03): a Hook goes through a Perfect Guard like it does
  a High Guard (chip damage, no attacker stun, no stamina bonus), so a
  well-timed Perfect Guard can be beaten by throwing a Hook.
- Dodge: i-frames, followed by a distinct dodge penalty: 24 vulnerable frames, walking speed at 40%,
  and no further dodge until the penalty ends. Dodge costs 14.4 stamina
  (+20%). Stunned dodge penalties retain their existing duration multiplier.
  The first punch thrown within the separate 6-frame follow-up buff after
  dodge ends is powered up (1.5x); throwing it consumes only the buff,
  not the penalty. Hook base reach is 31.
- Punch hitboxes extend forward from the facing direction. No directional
  armour.

## Hit resolution
| Scenario | Stamina | Damage |
|---|---|---|
| Sweet vs High Guard | Both lose | None |
| Sour vs High Guard | Attacker loses | None |
| Sweet vs Normal (body) | None (body hits cost the defender no stamina) | Reduced |
| Sour vs Normal (body) | Attacker loses | None |
| Sweet vs Vulnerable (face) | Defender loses | Full |
| Sour vs Vulnerable | Defender loses | Reduced |
| Jab / Cross / Uppercut vs Perfect Guard | Attacker stunned; defender recovers | None |
| Hook vs Perfect Guard | Treated as a High Guard block | Chip only |

## Counters
- Cross or Hook connecting during the opponent's Startup = counter: 1.5x
  damage, +2 Stars total (`stars.counterGain`; not stacked with the
  sweet-hit star). Changed from +1 on 2026-09-30.
- Jab on Startup = normal hit that interrupts. Uppercut is never a startup counter.
- Punish (2026-10-06): ANY punch (Jab, Cross, Hook, Uppercut) that connects
  while the defender is in a guard-release penalty, the dodge tail or the
  post-dodge vulnerable window gets the same counter bonus (1.5x damage and
  stun, double hit-stop, counter stars).
- Defender stamina is only lost on face hits (the full-damage row) and
  sweet blocks; body hits drain none.
- Distinct flash and sound.

## Star Power / Uppercut
- Sweet hits grant +1 star (not vs High Guard).
- Chain breaks (stars reset) when the player takes a sweet hit, is
  Perfect Guarded, or gets stunned. Sour hits taken, punches blocked by
  High Guard and whiffs keep the chain (changed 2026-09-30 / 2026-10-03).
  No time decay.
- At 3 stars Uppercut is active: near-instant startup, hook reach, 2x sweet
  Cross damage, cannot be blocked by High Guard, but a Perfect Guard stops it
  (changed 2026-10-03); can be dodged.
  Always resolves on the Vulnerable row, even on the outer ring
  (2026-09-30): sweet 2x Cross, sour 1x Cross.
- Uppercut whiff: stars consumed and a long Vulnerable recovery.

## Stamina, Health, Stun, Fatigue
- Punches and dodges require their full stamina cost (including character
  modifiers). An unaffordable press is discarded and flashes red only in
  the empty part of that fighter's stamina meter; it cannot execute later
  when stamina regenerates. Infinite-stamina training bypasses this check.
- Stamina spent by attacking, dodging, holding Guard. Moderate regen when
  not attacking, fastest with no input. Zero = forced Vulnerable ("low
  stamina"), which lasts until stamina climbs back to 30; regen is much
  slower during that state.
- Vulnerable means "no guard": every hit uses the full-damage Vulnerable
  row, no crit bonus. Guest's view is not mirrored.
- Health zero = KO (win condition).
- Stun meter builds from direct hits taken and from attacking into Perfect
  Guard; decays otherwise. Over threshold = stunned for base + overflow.
  Stunned: forced Vulnerable, cannot attack, can move/dodge with slower
  recovery. Meter resets when stun ends.
- Fatigue: repeating a punch type builds that type's counter, reducing
  speed, recovery speed and damage. Per type: Jab 4 bars, Hook 3, Cross 2,
  each with its own per-bar penalty (full bars = same max penalty). Whiffs
  count. A type's fatigue only decays after ~1 s without throwing it
  (decay pause). A fatigued throw shows a subtle grey "tired".

## Tutorial
17 guided steps (move, jab, cross, sweet/sour range, hook, guard, perfect
guard, dodge, dodge power-up, stamina, face vs body, punish, counter,
stars & uppercut, stun, fatigue, final KO), UI revealed only as needed,
progress remembered, linear with SKIP.

## Training
- Dummy is static; a button cycles its stance: Normal, High Guard,
  Vulnerable. Its HP never refills until RESET.
- "i" button toggles the hitbox overlay plus a hit/hurt box table
  (frame data, hit table). Does not pause.

## Online
- 3-character room code; host screen shows the code, a QR code and a
  `?room=CODE` link that joins directly.

## Arena
Square ring (310x310 logical px).

## Match
Single 99-second round, opened by a READY... GO! countdown
(`match.introSec`, 2 s; nobody can act until GO, the timer starts at GO). KO wins; on timeout higher health percentage wins,
tie = draw.

KO animation (visual only, all modes including Training; decided
2026-09-30):
- Drop: finished by a Jab, chip damage, or any sour hit (sour Cross/Hook
  included). The loser slumps flat where they stand, in slow motion.
- Fly: finished by a sweet Cross or Hook, or any Uppercut. The loser is
  knocked along the blow to the ropes in slow motion and sits down
  against them.
- Meanwhile the winner's last punch plays out its recovery in slow motion.
  The result screen waits until the animation ends. Timings in the KO
  tune category.

## Limb animation
- Jab and Cross extend the striking arm straight; the elbow straightens
  progressively and the glove cuff stays aligned with the forearm.
- Hooks wind up outward, snap through a mirrored circular arc to the
  contact point, then follow through and return with a bent elbow.
- Uppercut uses an outlined orange/yellow flame with a bright core and
  embers to cover the striking arm and glove, fading during recovery.
- Foot gait cadence is 40% slower (0.21 radians per pixel travelled,
  previously 0.35). Movement speed, combat frames and hitboxes do not change.

## Hit feedback
Judged from the local player's side. Landing a hit: bright directional
Tekken-style spark along the punch direction, white flash on the opponent,
damage number, light shake. Taking a hit: orange/red spark, red screen
edges, stronger shake, vibration (Android), duller sound. Counters get a
bigger spark: "COUNTER!" when you land one, "PUNISHED!" when you take one;
the text shakes as it fades. Optional hit-stop (`hit.hitstopFrames`, off
by default) freezes the fight logic briefly, in sync online.

## UI
All in-match elements (touch controls, health/stamina/stun meters, star
meter, fatigue indicator, timer) are drawn in the Phaser canvas. No React
or Tailwind. Lobby, menus and results follow current pipeline conventions
(confirm with the user before building them).

## Networking
Rollback netcode (replaced the v1 lockstep on 2026-09-30 after lag on
mobile data): small fixed input delay, the opponent's input is predicted
and corrected by re-simulation when it arrives. The game only stalls when
the opponent is further behind than the rollback window; show a small
"waiting for opponent" indicator during stalls. The netcode lives inside
this prototype, not a shared package.

## Display and debug
The itch.io page uses Click to launch in fullscreen with Landscape orientation.
Keep this launch setting when updating the build. Title and gameplay must use
the same complete layered ring, including post bases, apron and steps, at the
master artwork's aspect. Fit the ring and boxers together below the HUD;
far ropes stay behind boxers and near ropes in front. Simulation bounds stay
unchanged.
Landscape only. There is no rotate prompt; in portrait the canvas scales to
fit and letterboxes. Debug tools (bug button, tune panel, hitboxes, net
stats, SYNC TUNE) are hidden in public builds and unlocked per browser by
opening the game once with `?debug=1` (`?debug=0` locks them again).

### Arena framing refinement (2026-10-07)
Scale the complete ring uniformly in its authored aspect. The outer top red
rope is 3% of screen height below the top UI strip; the outer bottom red rope
is 5% of screen height above the screen bottom. Frame from rope anchors rather
than the apron/steps bounds. Training dummy spawns at the exact ring center
and stays there across Reset and character switches. Reproject the gym floor
columns to match the ring plane; keep the existing artwork and UI layers.

### Round-opening camera (2026-10-07)
Open each round in the wider matching-ring reference view, then smoothly zoom
in over 900 ms during the opening. Final framing keeps the lowest step edge
5% of screen height above screen bottom and the outer top red rope 3% below
the top UI strip. The master aspect remains uniform. Ring, fighters, effects
and gym move together; HUD and controls remain fixed. Reduced-motion skips
the animated interpolation. Training Reset replays the opening.

## Floor perspective correction — 2026-10-07
Preserve the gym artwork’s authored converging tile columns as shown in the user’s annotated reference. Disable the previous flattening correction at neutral projection values. Keep the ring framing and round-opening zoom unchanged.

## Shared arena vanishing point — 2026-10-07
The floor columns and side ropes must converge toward the same point above the screen, following the annotated guide. Apply a shared presentation projection while retaining the zoom, top rope margin, steps margin and fixed HUD.
## Title floor and props — 2026-10-07
Apply the shared gameplay floor projection to the title and its ring. Separate the gym equipment into a transparent edge-props layer so the old floor seams do not reappear; keep the menu and ring clear.
## Clean gym props — 2026-10-07
Redraw the title equipment from its existing shapes and outlines with opaque solid local colours, controlled cel shading and restrained material texture. Remove patchy fills and extraction artifacts while retaining the alpha layer, registration and prop arrangement.

## Character selection presentation — 2026-10-07
Implement the approved character-select-v1 mockup using the existing character portraits: large inward-facing matchup portraits, blue/red rounded panels, a central VS, bold names and nicknames, six rounded stat bars in two columns, and a bottom roster with prominent confirmation. Single-player has explicit Your Boxer, Opponent, Fight steps: tapping a roster card selects without confirming. Keep local-device ownership and online readiness/hidden opponent semantics. When selection changes, the incoming fighter card/panel slides in with an eased alpha transition; the focused roster card lifts and highlights. Respect reduced motion. Use a separately rendered quiet gym backdrop, never bake controls or character artwork into it. Fit the authored landscape composition uniformly on desktop and phone.

## Camera-synchronised hit effects — 2026-10-07
Runtime hit sparks, guard rings, damage numbers and fighter callouts must remain attached to the same arena transform as the fighters during round-opening zoom, perspective projection and impact shake. Keep full-screen flashes, HUD and controls separate. Cover Phaser's actual scene-added event contract and cleanup with a regression check.
## Character selection portrait corrections — 2026-10-07
Align all portraits by their visible artwork baseline, including Bruno, while preserving their source PNG registration. Keep all six stat bars inset within both panels. Mia should look like a youthful adult with smooth cheeks and a serious experienced expression; preserve her established outfit, pose and outlined art style.

## Portrait size hierarchy — 2026-10-07
Selection portraits must read as Bruno largest, Marco medium, Mia smallest, measured by visible artwork height with a shared bottom baseline on either matchup side.

## Match presentation and best of three — 2026-10-07
Default competitive play to best of three (first to two round wins), with best of one available on character selection. Apply to solo, local and online matches; the online host chooses the format. Reset combat meters and positions each round, preserving series score. Draws award neither boxer a win and replay; round announcements continue counting. Crossfade through the existing Punchies logo/loading stamp splash between rounds, then announce ROUND N and FIGHT before combat. Only show a compact victory/defeat/draw label and Rematch, Change Boxer and Main Menu controls after the series ends, keeping the arena visible. A rematch clears the series score. Training remains continuous.

Increase all in-game fighter artwork, including the training dummy and KO presentation, to 150% of its previous size while preserving relative character proportions. Reduce combat and KO camera shake strength by 50%. These are visual changes; preserve collision bodies, attack reach and combat timing.

## Shared sprite and hitbox scaling — 2026-10-07
Supersede the earlier visual-only sizing decision: artwork and simulation geometry must use the same fighter scale, preserving Marco/Mia/Bruno proportions and including the training dummy. Scale normal/vulnerable hurt radii, core radius, glove hit radius, punch reach, fighter separation and rope clearance together. AI spacing and debug hitbox overlays must use the resulting geometry. Keep damage, stamina costs, movement speeds and frame timings unchanged.

## Emergency stamina recovery — 2026-10-07
Replace the old low recovery threshold and exhausted regeneration multiplier. At exactly zero stamina, enter emergency recovery until character maximum stamina is full. Show a red stamina fill and sweating. Regenerate continuously at the character's normal walking recovery rate, including while attacking, stunned or in hit-stop. Protect the recovering meter from all spending, incoming stamina damage and non-natural gains. All incoming hits use the headshot/vulnerable damage row. Allow punches without stamina cost, with half damage multiplied by all existing fatigue, sour/sweet, post-dodge buff and counter/punish modifiers; keep action timing, stun restrictions and uppercut star requirements. Guard and new dodge actions are disabled and produce the existing stamina rejection flash. Outside emergency, retain affordability checks and normal regeneration. No independent change to normal headshot geometry in this request.

## Smaller normal headshot zone — 2026-10-07
Reduce the base inner core/headshot radius from 15 to 10 (one-third smaller), retaining the shared fighter scale and character proportions. Keep outer body/vulnerable radii and attack reach unchanged. Normal contacts outside the core should register as bodyshots; emergency recovery and other vulnerable states still use the headshot row. Uppercut retains its existing headshot behavior.


### Stamina adjustment — 2026-10-07
Punches may start with insufficient positive stamina, draining the remainder to zero and entering emergency recovery. Dodge affordability remains enforced. Emergency recovery uses the normal standing-still rate (including character regeneration modifiers), continuously regardless of actions. Increase base costs of jab, cross, hook, uppercut, dodge and guard drain by 20%; preserve character modifiers and incoming stamina damage.


### Shop menu entry — 2026-10-07
Move Credits into Settings. Replace its title-screen position with a green Shop button. The shop is a coming-soon entry until the rewards, token and unlock design is approved. Credits returns to Settings.


### Punch Token and ranked ownership — 2026-10-07
Show a red-and-blue Punch Token icon and balance inside the main-menu Shop button. Initial display is zero until a real wallet exists. Boxers and skins require ownership in ranked as well as casual. Unlocks are earned through rewarded ads. New boxers should have balanced stat tradeoffs. MMR and leaderboard remain future work; MMR does not replace character balance. Reward rate and prices are still proposals, not approved values.


### Match presentation completion — 2026-10-07
Before the first round of a match (including rematches), selected portraits slide together around a fiery VS, then ROUND 1 and FIGHT. Do not repeat the clash between rounds or in training/tutorial. Keep simulation frozen and match clock untouched during the showcase; online peers share the same deterministic duration. KO lettering uses KNOCK then OUT impact brush styling with the triple bell. Compact final results use animated victory/defeat/draw text, series score and polished buttons, preserving fast pacing. Existing portraits showcase current characters; equipped-skin support remains future work.

### Approved integrated HUD and presentation — 2026-10-08
Use a central two-digit navy hexagonal timer with diamond round-win sockets on its upper slopes. Extend mirrored swept bars with curved inner joins, sharp diagonal tips and angular accents: HP spans about 80% of screen width; STM is 20% shorter than the preceding draft; STUN is shortest. Labels remain unframed. Place names beside STM and three uppercut star sockets beside STUN; remove J/C/H status counters. Charge sockets fill yellow; at full charge dim all three stars and overlay pulsing yellow UPPER, reverting when a charge is spent. Respect reduced motion with a steady ready label. Keep the ring clear of the HUD. Bottom-anchor half-body portraits, remove split red/blue clash panels, build anticipation with portrait vibration, and expand fiery VS beyond the screen into the arena. FIGHT shares the KO impact lettering. Pad italic lettering so right-side strokes remain visible.

## Portal layer (itch.io, CrazyGames, Poki, Playgama), 2026-10-08
One small interface (`src/portal/`) sits between the game and the site that hosts it, so the same game can ship to itch.io and to web portals. The game never calls a portal SDK directly.

- **Build-time choice:** `PORTAL=crazygames|poki|playgama npm run build` (default `web`, used by itch.io and local dev). `PORTAL_ADS=off` builds a portal version with no rewarded ads. A build contains only its own portal's SDK address; the default build makes no external request.
- **Gameplay events:** `gameplayStart/Stop` (CrazyGames, Poki) or `level_started/paused/resumed` (Playgama) fire only while a fight is live. They stop when the pause menu opens, when a result shows, and when a fight scene ends, and are de-duplicated. `loadingFinished` fires once, when the first menu is up.
- **Saves:** every saved value goes through `store` (same shape as localStorage) with a key listed in `src/portal/keys.ts`. CrazyGames uses its data module, Playgama uses Bridge storage (preloaded before the first scene), Poki and the default build use localStorage with a memory fallback for private mode. The debug unlock flag stays on plain localStorage on purpose.
- **Rewarded ads:** only in the Shop, on an explicit button press, never during a fight. The reward is granted only when the portal reports success; a skipped, failed or unfilled ad gives nothing. The game is silent while an ad plays and its input is blocked. The default build keeps the existing preview button (no ad is shown). If a portal build has ads off or the SDK fails to load, the button reads ADS UNAVAILABLE.
- **Not yet verified against the real SDKs.** The adapters follow each portal's published docs and are tested against mocks (`scripts/test-punchies-portal.mjs`). Each portal's own QA tool must be run before submitting.
- **Out of scope for now:** midgame ads, banners, portal accounts and usernames, leaderboards, in-app purchases.

## Analytics, 2026-10-08
Our own events go through the same portal layer: `track(category, what, action, props)` in `src/portal/analytics.ts`. Anonymous only: no ids, no personal data, only game facts.

- **Where events go:** Poki receives `measure(category, what, action)`. Playgama receives `analytics.send("<category>_<action>", { what, ...props })`. itch.io and CrazyGames keep only the local log (CrazyGames has no custom event module). No external collector exists yet, so no data leaves the browser on itch.io. The debug panel (`?debug=1`) has a "Copy analytics events (JSON)" button for the last 300 events, which are kept in memory only.
- **Events:** `fight/<scene>/round_start`; `match/VsAI/win|lose|draw` (with level and character), `match/Online/win|lose|draw`, `match/LocalVs/finished|draw`; `tutorial/step_N/reached` and `tutorial/all/complete`; `shop/shop/open`; `rewarded/shop_token/visible|interact|rewarded|failed|unavailable`; `chest/<skins|fighters>/unlock` (with item id); `online/host|guest/connected` and `online/guest/failed` (reason: `room_full` or `no_host`).
- **Rule for new events:** short snake_case names, variable values in props, no free text, and nothing that identifies a person. A portal that needs a privacy notice for extra data (CrazyGames, Poki) must get one before an external collector is added.
- **Out of scope for now:** an own collector (for example a small Cloudflare Worker), an anonymous id, session length, and funnels beyond the events above.

## Lobby connection line, 2026-10-08
The online lobby (host and guest) shows one small dim line under the status text: `relays <open>/<pinned> · TURN yes|no · <seconds>s`. It tells a tester why a lobby is stuck (no signalling relay reachable, TURN not fetched) without a debugger. A guest that times out also records `online/guest/failed` with the same numbers, and a lobby that has waited 15 seconds with no relay open records `online/lobby/no_relays`, both visible in the debug analytics copy.

## Localisation, 2026-10-08
Phase 1 of the translation layer is in `src/i18n/`. Languages for the first pass: English, Japanese (ja), Korean (ko), Chinese Simplified (zh), Spanish (es) and Arabic (ar). Arabic is right-to-left text only: the layout is not mirrored.

- **Game code:** every player-facing string is `t('area.key', { name: value })`. Placeholders are written `{name}`. A missing translation falls back to English, then to the key. Developer-only text stays English: the reference panel (`InfoPanel`), the network stats readout and the lobby diagnostic line.
- **Files:** `locales/en.json` is the source. `locales/<code>.json` hold translations and are loaded only for the player's language. `locales/index.json` lists how many strings each language has; a language is offered only when it has translations (the debug panel, `?debug=1`, offers all six).
- **Choosing the language:** the saved choice, then the portal's language (CrazyGames and Playgama adapters, not yet checked against the real SDKs), then the browser language. `?lang=<code>` forces one, and `?lang=pseudo` wraps every translated string in ⟦ ⟧ so any hardcoded English is easy to spot.
- **Landing page button:** a small button at the top right shows the current language and opens a picker. Choosing a language saves it and reopens the menu.
- **Translating:** `node scripts/i18n-sheet.mjs export [file.csv] [--formulas]` writes a sheet with one column per language (with `--formulas`, empty cells hold `=GOOGLETRANSLATE`). After review, download the sheet as CSV and run `node scripts/i18n-sheet.mjs import <file.csv>`. Placeholders are repaired (`{ name }` becomes `{name}`) and cells with the wrong placeholders are rejected and listed. `check` validates the files.
- **Fonts:** Japanese, Korean, Chinese and Arabic use the system font list after the game's own font. Bundled narrow fonts for languages that need more room are the next step (they add download size). Buttons and labels do not yet shrink to fit long translations.
- **Not translated:** character names, the logo, the version stamp and the `P(COM)` floor marker.

## Roster strip on character select — 2026-10-08
The roster moves from the bottom to a bright gold-framed strip under the step chips, above the two matchup panels. The strip has no fixed fighter count: it fits when short (centred) and otherwise scrolls sideways by dragging, with pulsing left and right arrows that page four tiles and tiles fading at the edges. Moving the focus to a fighter scrolls it to the centre. Selected tiles get a gold outline. The VS burst is drawn above both panels. Inactive step chips and unfocused panel frames use a quiet neutral so the strip and the focused panel carry the colour.

## Aggregated character stats and playstyle label — 2026-10-08
Character select shows five bars: Health (HP), Endurance (average of stamina and stun resistance), Speed (average of walk speed and hand speed from jab, cross, hook and uppercut frames), Power (average damage multiplier over the four punches) and Reach (average punch reach including body proportions). Dash distance is identical for every fighter today, so it is not part of Speed until fighters get their own dash. Bars use the existing scale where the base tune sits at 80%. The line under the name is now a playstyle label: Marco Vanilla, Mia Agile, Bruno Tank, Tee Glass Cannon.

## Translation sheet pull — 2026-10-08
`node scripts/i18n-sheet.mjs pull [csv-url]` downloads the sheet published to the web as CSV (File > Share > Publish to web > Sheet > CSV), checks it is CSV with most English keys present, repairs placeholders and writes the locale files. The game never fetches the sheet at runtime (portals restrict outside requests and machine text should be frozen after review). The "Pull Punchies translations" workflow runs the same pull from the `I18N_SHEET_URL` repository variable and opens a pull request without merging it.

## Room code keypad layout — 2026-10-08
The join keypad is QWERTY-ordered with the digits 2 to 9 as the top row, then Q to P, A to K and Z to M plus DEL. Look-alike characters (0, O, 1, I, L) stay excluded from room codes and from the keypad.

## Roster expansion — 2026-10-09
Tyke Maison and Dragon replace fighter pool placeholders and begin locked until pulled. Tyke is a bald, huge African American heavyweight with white eyes, lightning facial ink, gold gloves and a championship belt. Dragon is a medium-weight karate fighter in a white gi, red padded fingerless gloves, bare feet and a red 滅 blindfold with two independently animated cloth tails. Each starts with a separate copy of Marco's tune entry; user will tune later. Tyke's render/hit geometry proportion is 1.18, Dragon 1.0, compared with Marco 1.0.
Mia's Flaming Kunoichi unique skin retains Mia stats and blonde identity, with red/white ninja robes, slim half gloves and separate ponytail. The skin uses its own portrait and rig parts. Cyan Rush, Violet Resolve and Golden Veteran are no longer automatically available; all three are locked palette skin pool rewards and require explicit ownership, including on existing saves where they were previously implicit. Explicit owned records remain owned. Daily offers schema advances to refresh cached offers once. Welcome G.P. Tee remains unchanged.

## Tee is a chest fighter — 2026-10-09
G.P. Tee is no longer a free one-time claim in the Shop. He is a normal reward in the daily fighter chest. Players who already claimed him keep him (the old welcome item id is kept so saves stay valid). Locked-fighter messages on character select now point at the daily chest for every locked fighter.

## First launch: the easy fight — 2026-10-09
A new save (no `punchies:firstrun:v1` flag) opens straight into a gentle bout instead of the main menu: Marco against Bruno, best of one, no timer. Only the stick, JAB and CROSS are shown and usable, and only the health bars show. Coach text moves through walking up, jabs, crosses and "mix them". Bruno walks up and throws slow jabs, never blocks or dodges, and the player cannot lose (health refills below 50%). Each landed hit drains an even share of Bruno's health, so six hits end the fight. The fight's own numbers are in `src/firstrun/firstfight.json`; no existing tuned value changes.

A SKIP button is always visible. Finishing or skipping saves the flag, grants the gift once (Marco "Rising Star" and one free skin chest), shows the reward reveal, then "WELCOME TO THE RING" and the main menu. The Shop button shows a red badge while the free chest is waiting; it opens without tokens and does not use the daily skin chest. `?room=` links skip the flow. `?debug=1&firstrun=1` replays it. Analytics: `firstrun/fight/start`, `firstrun/<punch>/hit`, `firstrun/win|skip/done`.

## Reset save and debug tokens — 2026-10-09
Settings has a RESET SAVE button. It asks twice ("DELETE LOCAL SAVE?" then "ARE YOU REALLY SURE?"), then removes every saved key on this device (audio, shop, tutorial progress, characters, local inputs, language, first launch flag) and reloads, so the game starts like a brand new install including the language choice and the easy first fight. With `?debug=1` the Shop shows a DEBUG: 99 TOKENS button that sets the balance to 99 to test the chests.

## Progression logic — 2026-10-09
Boxer Level (1 to 50) from XP, saved under `punchies:progress:v1`. XP per finished match: vs AI 10 plus 20 for a win, times 0.5 / 1 / 1.5 for easy / medium / hard; online 15 plus 25 for a win; local VS 10; first launch fight win 60; training and tutorial 0. A hard cap of 300 XP per UTC day. XP to the next level is 100 plus 25 per level. Rewards only at milestones: a free skin chest every 5 levels, a free fighter chest every 10, titles by level, and earn-only Veteran skins. Chest rewards are vouchers, not tokens. Config is in `src/progress/progress-config.json`. See docs/release-plan.md section 8.
