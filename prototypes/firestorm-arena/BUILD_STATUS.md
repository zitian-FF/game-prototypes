## Current milestone

Version 0.16.5 on the branch (0.16.4, the rendering performance pass, is merged; 0.16.5 is the atmosphere pass)
model, commander cache score, mobile touch controls, 16 letter room codes, orders panel beside every selected target.

## What was implemented

- Square map, four neutral non-capturable Portal Nexus nodes (teleport target for any HQ, light 8 cells for both teams).
- Quieter order lines (`lines.strength 0.4`); bots advance front by front, 10% distant raids, scout only enemy-held nodes.
- Cache model: 60 s settling timer after any capture, pool opens, pool dropped as 4 to 8 permanent equal caches only
  on a swap; scouts of any team bank them for their own team; commander gets +1 per cache point (new Caches column).
- Bots go for all visible caches but skip ones a closer friendly scout is already heading for.
- Selected target panel: orders always on the right, equal heights, centred, slides clear of the squad panel.
- Room codes now 3 of 16 letters (server regexes, client, e2e updated). Protocol 8.
- Mobile: touch intents (tap, drag, pinch, long press), `touch-action: none`, responsive UI scale for touch windows,
  canvas on-screen keyboard (name qwerty, room code 4 x 4 pad), touch hint line.
- arena-sim and firestorm-net 0.11.0.
- 0.16.5: atmosphere. Terrain patches and decals, team territory glow, battle scars and tread marks, drifting embers. All cosmetic, under the fog, using only what this client sees.
- 0.16.4: rendering performance. Node and HQ art is baked into textures and shown as pooled images in a layer under the live vectors; HUD squad portraits are baked too; dashed march lines are clipped to the view and their dashes scale with the node scale when zoomed out.
- 0.16.3: Accelerator reads as a movement speed percent in the node panel and Handbook (shared helper `src/speedPct.ts`). The itch deploy now waits and retries up to 6 times, 90 s apart, only when itch says the previous build is still processing.
- 0.16.2: nodes keep a constant screen size below zoom 0.6 (`camera.nodeFixedZoom`, max 4x), with labels, rings and tap area scaled to match.
- 0.16.1: Return to HQ on every field squad, Hospital recovery per second beside Reserve, Tech Centre teleport countdown with tenths, speed tag and flash, buff icons top left.
- 0.16.0: onboarding pass: objective card with danger/alert/good/guide levels and tap-to-look, Next Moves list with pan-and-ring, goal line and points per second, green own base, contextual panels and flashes, plain node panel with More, contiguous minimap fog, retiring hints and Tips toggle, logs limited to your fights. Slot tiles removed from the ground.
- 0.15.6: capacity line shows percent left and roughly how many 30 minute games (`QuotaStatus.percentLeft`).
- 0.15.5: Handbook page on the main menu (four tabs, scrollable, numbers from tune.json); node panel text shortened and wrapped by measured width (`Ui.measure`, `Ui.wrap`).
- 0.15.4: auto-selected strongest HQ squad (re-picked after a squad is sent); game log v2 (dealt squads with percentile and tier, connect and drop events); usage meter saved on every report and reported when the last socket leaves; map test over 400 seeds that both halves hold the same kinds and tiers.
- 0.15.3: the tier star shows on squad 1's card only; squad 2 keeps the glow, edge and label.
- 0.15.2: reveal-card tiers only for squads 1 and 2 (`roster.cardTierSlots`), with a big gold, silver or bronze star on the card.
- 0.15.1: the opening card reveal is 7 real seconds and the match clock starts after it (`match.introSeconds`), orders are refused during it.
- 0.15.0: squad bands 1-12, 8-20, 15-20, 18-20 (first two squads fight, 3rd and 4th are utility); opening card reveal with gold, silver and bronze glow by percentile within each slot's own power range. arena-sim 0.14.0.
- 0.14.0: player behaviour log (one record per human per match in a GameLogs Durable Object, owner-only /admin/logs behind a LOG_TOKEN secret, 90 days or 20,000 rows), device sent in hello, landing-page notice. arena-sim unchanged, firestorm-net 0.14.0.
- 0.13.4: speeds reworked: base edge to edge 150 s, each Accelerator cuts 30 s (120 s, 90 s) for squads only, scouts and missiles fixed at 5x the unboosted base. arena-sim 0.13.0.
- 0.13.3: teleport-slot glow in team colour when a teleportable node is selected, scout names removed, scouts 50% faster.
- 0.13.2: static unit sprites when zoomed out or crowded, pooled world labels (world draw about 2 to 6 times cheaper in a software-GL test), interface palette separated from team colours (violet accent, crimson danger), Teleport button reads the cooldown.
- 0.13.1: edge Home marker pointing at the HQ with a distance in cells, marching 80% faster (crossMapSeconds 183), Teleport button greyed with a reason instead of hidden.
- 0.13.0: touch HUD v2 (squad chips, anchored target bubble, icon rail, closer start zoom), Home button shown only when the HQ is off screen (H key on desktop, auto-centre on teleport), pinch zoom anchored on the fingers' midpoint, toasts limited to two on touch.
- 0.12.3: Tech Centre makes the teleport cooldown run faster (x2 with one, x3 with two), bots skip already scouted or targeted nodes and HQs, whole-troop refills, phone rendering optimisations (label re-render only on change, off-screen culling; world draw about 7x cheaper in a software-GL headless test).
- 0.12.2: compact touch HUD (slim foldable squad list, small minimap, top-bar Scouts and Logs chips, two-column orders bar).
- Follow-up: fullscreen plus landscape lock on first tap or click (not iOS); tapping a selected squad card focuses the camera on it.

## Key technical decisions

- Atmosphere (0.16.5): terrain is one static quarter-resolution canvas plus decal images; territory is a 1/16-resolution canvas repainted only when held nodes change (a full-size one stalled every ownership change); scars, treads and embers are capped (40, 90, 28) and drawn in one graphics layer. Scars land in a ring around the fight, because node and HQ art would hide a mark right on top.

- Baked art (0.16.4): `ArtCache` renders a look once at 2 texture pixels per world pixel, keyed by everything that changes it (kind, tier, colours, lock, and the animation step for refineries, portals and the HQ flag). Above `perf.bakedArtMaxDensity` (2.4) device pixels per world pixel the scene switches back to live vectors, with hysteresis; that only happens zoomed in, where few nodes are on screen. Higher bake resolutions were rejected to keep GPU memory low on phones (about 30 textures per match at about 220 KB each, roughly 7 MB).
- Selection, hover and the own-HQ ring moved from the entity layer to the line layer so they stay under the baked art.

- Touch is detected from `(pointer: coarse)` or the first touch pointer; `UI_SCALE` divides logical size and
  multiplies camera zoom and text resolution, so layout code is unchanged.
- Caches carry `from` (the losing team); only a swap spawns them, ids are hash based so replay stays deterministic.
- Room alphabet shrinks to 4096 codes; collisions only matter between live rooms.

## Open questions

- Usage counter now shows percent left (moves smoothly). The games figure still assumes 4,000 writes and 2,500 requests per 30 minute match; measured is about 1,000 writes (request cost at real speed unmeasured), so consider lowering the constants after a real-time measurement.
- A tester saw an Accelerator on only one side of the map. The generator always makes one per half (tested over 400 seeds), so the likeliest cause is fog hiding the far one; need the room code or a screenshot if it happens again.

- Game log: needs `wrangler secret put LOG_TOKEN` before the endpoint exists; confirm records look right after the first real matches.
- A tester reported being unable to teleport to a captured node until he scouted it. The sim has no such rule and a scripted capture then teleport worked at once; the likeliest cause was the Teleport button being hidden on cooldown. Waiting for the tester's details (device, HQ pill text, any toast).
- Scouts and missiles sped up by 80% together with squads; say if scouts should stay as they were.
- BRIEF.md was updated for the cache model, glossary, mobile and room codes; confirm the 4096 code space is acceptable.
- Should a match be playable in portrait on a phone, or is landscape only fine?

## Known issues

- 0.16.5 checked on desktop in a real match at 15x speed: screenshots at zoom 1, 0.45 and fully out. Cost against the 0.16.4 numbers, 4x throttle: about +5 ms render submit at start zoom, +9 ms zoomed out; still well under 0.16.3. Not checked on a phone. All atmosphere strengths are first guesses in client.tune.json `atmosphere`.

- 0.16.4 measured in headless Chromium with software WebGL and 4x CPU throttle, not on a phone. Script plus render-submit time per frame, main vs 0.16.4: desktop start zoom 38 to 23 ms, zoomed out 61 to 30 ms; 844 x 390 DPR 2 touch, start zoom 40 to 32 ms, zoomed out 69 to 35 ms. Frame rate under software WebGL is GPU-bound and not meaningful. Baked tile outlines are a touch thinner than live ones from texture filtering.

- 0.16.2 checked on desktop at start zoom and fully zoomed out (nodes stay about 40 px). Not checked on a phone. The HQ block and units still shrink with the map, and `nodeFixedZoom` 0.6 is a first guess to tune.

- The itch account was renamed from zitian-ff to polsia. Only the Firestorm Arena Butler target (`polsia/firestorm-arena:html5`) is updated here. Other prototypes' workflows and the hub links still say `zitian-ff` and will break until their owners update them.

- 0.16.1 checked on desktop in a real match at 30x speed (Return to HQ, +20/s, x2 countdown with flash, three buff icons) and on emulated touch for the pill and a buff icon; the touch chip HQ button was not seen in action. Buff icon colours and the 'x2' wording are first guesses.

- Onboarding pass checked on desktop 1280 x 720 and emulated 844 x 390 touch with real matches and with a forced danger, alert and good card; a live "about to be attacked" warning was only checked by a scripted unit check of the logic, not seen in a real match. The Next Moves rules (nearest node, one cue per kind) are first guesses to tune from the game logs.

- Handbook checked in desktop 1280 x 720 and emulated 844 x 390 only; it reads numbers from tune.json at build time, so a server tune change needs a client rebuild to match. The wording is mine and has not been proofread by the designer.

- Fullscreen and landscape lock could not be exercised in headless Chromium; needs a real Android phone and desktop test.
- iOS gets no fullscreen or lock and no rotate hint, so portrait play there is cramped.
- Touch HUD v2 checked only in emulated 844 x 390 landscape; real phones, tiny phones and tablets unchecked. The Scouts and Logs panels and the menu popup were not re-checked visually. The default touch zoom (1.7) is a first guess to tune.
- Pinch anchoring is exact away from the map edge; the camera centre is clamped to the map, so near an edge the anchor can slide.
- Touch was verified with Playwright touch emulation only, never on a real device.
- Portal Nexus causes heavy early HQ brawls; bot HQ aggression numbers are first guesses.
- Old stored rooms will not replay under the new rules.
- The real deployed Worker was not exercised from the sandbox, only local wrangler.

## Next proposed step

Merge and deploy 0.16.5, then the in-match world art direction proposal (two mockup options).
