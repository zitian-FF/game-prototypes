## Current milestone

Version 0.15.5 on the branch (PR #209 merged up to 0.15.3; 0.15.4 and 0.15.5 not merged, no PR open): square 41 x 41 map with four Portal Nexus nodes, final cache
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

- Touch is detected from `(pointer: coarse)` or the first touch pointer; `UI_SCALE` divides logical size and
  multiplies camera zoom and text resolution, so layout code is unchanged.
- Caches carry `from` (the losing team); only a swap spawns them, ids are hash based so replay stays deterministic.
- Room alphabet shrinks to 4096 codes; collisions only matter between live rooms.

## Open questions

- Usage counter: it assumes 4,000 writes per match but a measured full 30 minute match costs about 1,000, so the headline number only drops about once per 3 to 4 matches. Keep the cautious constant, lower it, or show percent used? Not changed.
- A tester saw an Accelerator on only one side of the map. The generator always makes one per half (tested over 400 seeds), so the likeliest cause is fog hiding the far one; need the room code or a screenshot if it happens again.

- Game log: needs `wrangler secret put LOG_TOKEN` before the endpoint exists; confirm records look right after the first real matches.
- A tester reported being unable to teleport to a captured node until he scouted it. The sim has no such rule and a scripted capture then teleport worked at once; the likeliest cause was the Teleport button being hidden on cooldown. Waiting for the tester's details (device, HQ pill text, any toast).
- Scouts and missiles sped up by 80% together with squads; say if scouts should stay as they were.
- BRIEF.md was updated for the cache model, glossary, mobile and room codes; confirm the 4096 code space is acceptable.
- Should a match be playable in portrait on a phone, or is landscape only fine?

## Known issues

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

Open a PR and merge after approval, then playtest on a real phone and tune touch sizes and HUD layout.
