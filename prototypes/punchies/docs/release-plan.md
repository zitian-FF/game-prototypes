# Punchies release plan and content roadmap

Live document. Claude owns the plan sections. Codex keeps the inventory tables
(section 5) up to date as art lands. The owner decides. Change this file by pull
request and add a line to the update log (section 9) every time.

Status words: `done`, `in progress`, `planned`, `blocked`, `?` (unknown, needs an answer).

## 1. Decisions so far

| Decision | Choice | Date |
| --- | --- | --- |
| First-run experience | Easy first fight, first time only, skippable | 2026-10-09 |
| First-run fighter | Marco, best of 1, jab and cross only | 2026-10-09 |
| First-run gift | Marco "Rising Star" unique skin | 2026-10-09 |
| Starter alternate skins (Cyan Rush, Violet Resolve, Golden Veteran) | Removed as free starters. They become normal pull items | 2026-10-09 |
| First chest | The player's first skin chest is free (no token gift) | 2026-10-09 |
| Sparring partner | Bruno | 2026-10-09 |
| G.P. Tee | No longer a free claim. He joins the fighter chest pool | 2026-10-09 |
| Ranked / MMR | Pushed back past launch. Log anonymous match results meanwhile | 2026-10-09 |
| Progression | Boxer Level from XP. Tokens only at milestones. Earn-only skins, titles, frames. Hard daily XP cap | 2026-10-09 |
| Profile | Dedicated profile screen with alias, level, title. Title shows in online fights | 2026-10-09 |
| Currency | One token currency, used to unlock fighters and skins | earlier |
| Ads | Rewarded only, in the shop only, never during or between fights | earlier |
| Analytics | Anonymous events on the portal layer, no external collector yet | earlier |
| Languages | EN, JP, KR, CN, ES, AR. Machine translation reviewed in a sheet, frozen at build time | earlier |
| Portals | Build-time adapters: CrazyGames, Poki, Playgama. itch.io stays the default build | earlier |

## 2. First-time experience (spec)

Runs once for a new save, stored in the single save blob (`firstRun` flag, versioned key).
A returning player (flag set) never sees it. A Skip button is always visible.

Flow:
1. Language choice, only when more than one language has translations.
2. The easy fight. Marco against a sparring partner, best of 1.
3. "Welcome to the Ring" card with the reward reveal (Marco "Rising Star", plus the token gift below).
4. Main menu. The Shop button shows a badge while the free first skin chest is waiting.

Skip: ends the flow at step 3 (same gift, so skipping never costs anything). Marks `firstRun` done.

The easy fight:
- Visible controls: move, jab, cross. Hidden on touch and keyboard hints: guard, dodge, hook, uppercut.
- Visible HUD: health bars only. Hidden: stamina, stun, stars.
- Coach text in order: "Tap JAB", "Now CROSS", "Mix them". Repeats after about 10 seconds of no punches.
- Sparring partner: Bruno. Slow, weak jabs on a long cooldown. Cannot KO the player (player health floors above zero). Falls to a clean KO after about six hits.
- All its numbers live in their own tune section (for example `firstFight`). No existing tuned value changes.
- Reports gameplay start and stop to the portal. Funnel events: `firstrun/start`, `firstrun/jab`, `firstrun/cross`, `firstrun/win`, `firstrun/skip`.
- The full tutorial stays in Practice for players who want the rest.

Gift: Marco "Rising Star" on the reveal, and the first skin chest is free. The player opens it from
the Shop (the Shop button badge points there), so they learn how pulls work without spending.
`welcomeGiftTokens` stays 0. The free chest is a one-time flag in the save, separate from the daily
chest limit.

Open questions:
- Is it only the first skin chest that is free, or the first fighter chest too? Assumed skin chest only. `?`
- Where does Tee come from now? Assumed the fighter chest (10 tokens) with the two placeholder fighters. `?`
- Existing testers who already claimed Tee keep him. Assumed yes. `?`

## 3. Economy snapshot (from `src/shop/draft-config.json`)

| Setting | Value |
| --- | --- |
| Skin pull cost | 5 tokens |
| Fighter pull cost | 10 tokens |
| Rewarded ad reward | 1 token |
| Daily ad limit | 5 (so at most 5 tokens a day from ads) |
| Chests per day | 1 skin chest, 1 fighter chest |
| Welcome gift tokens | 0. The first skin chest is free instead |
| Day boundary | 00:00 UTC |

Reading: a daily ad-only player earns one skin chest a day, or one fighter chest every second day.
With 9 skins in the pool, a daily player sees the whole skin pool in about two weeks, which is
short. The fighter pool has only two placeholder fighters. Content volume, not price, is the
launch constraint: see section 5.

## 4. Launch plan

Gates before any portal submission:
1. First-time experience built, tested on a real phone.
2. Starter alternate skins moved into the pull pool (see section 6).
3. Translations pulled and reviewed, language picker visible, Arabic and CJK checked on a phone.
4. Online play checked on iPhone host and Android guest (open bug), with the lobby diagnostic line.
5. Real portal SDK QA (each portal's own QA tool). The adapters so far only ran against mocks.
6. Final art and audio in R2, size budget checked.
7. Balance pass owner sign-off (the balance workshop page exists).

Suggested portal order:
1. itch.io: live now. Keep as the test bed.
2. CrazyGames first: clearest rules, data module for saves, rewarded ads allowed, English required.
3. Poki second: stricter (no external requests, external accounts or chat, long exclusive terms). Read the deal before submitting.
4. Playgama third: its own storage and analytics. External analytics are not allowed.

Size budget: CrazyGames wants an initial download of 50 MB or less, and 20 MB or less for the
mobile homepage placement. The game is about 12 MB plus about 12.5 MB of music in production
builds. Music can be streamed after the first screen if the mobile placement matters.

## 5. Content inventory (Codex keeps this current)

Art status columns: portrait, rig (the sprite set used in fights), palette swap (cheap recolour in code).

### Fighters

| Fighter | id | Role label | How obtained at launch | Portrait | Rig | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Marco Reyes | `marco` | Vanilla | Owned from the start | done | done | Tutorial and first fight fighter |
| Mia Tanaka | `mia` | Agile | Owned from the start | done | done | |
| Bruno Kowalski | `bruno` | Tank | Owned from the start | done | done | |
| G.P. Tee | `tee` | Glass Cannon | Fighter chest (no longer a free claim) | done | done | Hidden in roster until owned |
| Longan | `fighter-longan` | `?` | Fighter chest | `?` | `?` | Provisional stats. Added in #274 |
| Tyke Maison | `fighter-tyke` | `?` | Fighter chest | `?` | `?` | Provisional stats. Added in #274 |
| Dragon | `fighter-dragon` | `?` | Fighter chest | `?` | `?` | Provisional stats. Added in #274 |
| The Rookie | `fighter-five` | `?` | Fighter chest (placeholder) | `?` | `?` | Name and stats pending |
| The Southpaw | `fighter-six` | `?` | Fighter chest (placeholder) | `?` | `?` | Name and stats pending |

### Skins

Type: `palette` (colour swap of the same art) or `unique` (own portrait and rig set).
Launch source for every skin below: skin chest (5 tokens), except the one gift.

| Skin | id | Fighter | Type | Launch source | Art status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Default | `default` | all | n/a | Always owned | done | |
| Rising Star | `skin-marco-unique` | Marco | unique | First-run gift | pending art | Portrait key `portrait_marco_rising_star`, rig `marco_rising_star` |
| Ring Captain | `skin-mia-unique` | Mia | unique | Skin chest | pending art | Portrait key `portrait_mia_ring_captain`, rig `mia_ring_captain` |
| Old Champ | `skin-bruno-unique` | Bruno | unique | Skin chest | pending art | Portrait key `portrait_bruno_old_champ`, rig `bruno_old_champ` |
| Cool Current | `skin-marco-cyan` | marco | palette | Skin chest | implemented | Runtime recolour; no additional image downloads |
| After Hours | `skin-marco` | marco | palette | Skin chest | implemented | Runtime recolour; no additional image downloads |
| Hotshot | `skin-marco-hotshot` | marco | palette | Skin chest | implemented | Runtime recolour; no additional image downloads |
| Violet Discipline | `skin-mia-violet` | mia | palette | Skin chest | implemented | Runtime recolour; no additional image downloads |
| White Lotus | `skin-mia-white-lotus` | mia | palette | Skin chest | implemented | Runtime recolour; no additional image downloads |
| Midnight Rose | `skin-mia` | mia | palette | Skin chest | implemented | Runtime recolour; no additional image downloads |
| Golden Hour | `skin-bruno-gold` | bruno | palette | Skin chest | implemented | Runtime recolour; no additional image downloads |
| Old Iron | `skin-bruno` | bruno | palette | Skin chest | implemented | Runtime recolour; no additional image downloads |
| Sunday Best | `skin-bruno-sunday-best` | bruno | palette | Skin chest | implemented | Runtime recolour; no additional image downloads |
| Redline | `skin-tee-redline` | tee | palette | Skin chest | implemented | Runtime recolour; no additional image downloads |
| Ghost Signal | `skin-tee-ghost-signal` | tee | palette | Skin chest | implemented | Runtime recolour; no additional image downloads |
| Ultraviolet | `skin-tee-ultraviolet` | tee | palette | Skin chest | implemented | Runtime recolour; no additional image downloads |
| Black Gold | `skin-tyke-black-gold` | tyke | palette | Skin chest | implemented | Runtime recolour; no additional image downloads |
| Platinum Storm | `skin-tyke-platinum-storm` | tyke | palette | Skin chest | implemented | Runtime recolour; no additional image downloads |
| Crimson Crown | `skin-tyke-crimson-crown` | tyke | palette | Skin chest | implemented | Runtime recolour; no additional image downloads |
| Night Dojo | `skin-dragon-night-dojo` | dragon | palette | Skin chest | implemented | Runtime recolour; no additional image downloads |
| Jade Temple | `skin-dragon-jade-temple` | dragon | palette | Skin chest | implemented | Runtime recolour; no additional image downloads |
| Autumn Ember | `skin-dragon-autumn-ember` | dragon | palette | Skin chest | implemented | Runtime recolour; no additional image downloads |
| Green Tea | `skin-longan-green-tea` | longan | palette | Skin chest | implemented | Runtime recolour; no additional image downloads |
| Plum Wine | `skin-longan-plum-wine` | longan | palette | Skin chest | implemented | Runtime recolour; no additional image downloads |
| Blue Hour | `skin-longan-blue-hour` | longan | palette | Skin chest | implemented | Runtime recolour; no additional image downloads |

| McClassic | `skin-marco-mcclassic` | Marco | unique | Skin chest | done | Portrait and complete rig shipped |
| Flaming Kunoichi | `skin-mia-flaming-kunoichi` | Mia | unique | Skin chest | done | Portrait and complete rig shipped |

Inventory: 7 existing fighters, 21 palette skins (3 per fighter), and 5 catalogued unique skins. Rising Star, Ring Captain and Old Champ remain pending artwork; ready unique skins are McClassic and Flaming Kunoichi. Four new fighters have portraits commissioned for approval only and are not in the playable pool.

### Content roadmap targets (owner to set)

| Target | Fighters | Skins | Notes |
| --- | --- | --- | --- |
| Soft launch | `?` | `?` | Suggested floor: 6 fighters and at least 4 skins per fighter, so a daily player still has goals after the first month |
| Month 1 update | `?` | `?` | |
| Month 2 update | `?` | `?` | |

Palette swaps are the cheap content lever. The recolour code today (`src/render/skinPalette.ts`)
is written per fighter with hard-coded hue ranges. Making skins data-driven (a palette table per
skin: which hue ranges map to which new colour) would let a new palette skin be added with one
table entry and no new art. See section 6.

## 6. Build tasks

| Task | Owner | Status |
| --- | --- | --- |
| First-time experience (flow, easy fight vs Bruno, skip, Rising Star reveal, free first skin chest, welcome card, Shop badge) | Claude | built, needs phone test |
| Remove the free Tee claim: Tee joins the fighter chest pool, welcome claim UI removed, existing owners keep him | Claude | done |
| Starter alternate skins join the chest pool; nobody gets them free | Codex (#274) | done |
| Data-driven palette swaps (table per skin) so new palette skins need no code | Codex | implemented; review branch |
| Unique skin art and rigs (Rising Star, Ring Captain, Old Champ) | Codex | `?` |
| Tee portrait and rig confirmed final | Codex | `?` |
| Fighters five and six: design, stats, art | Owner, Codex | `?` |
| Translation sheet created, published, pulled, reviewed | Codex, owner (Chinese) | in progress |
| iPhone online play fix | Claude, with owner retest | blocked on owner retest |
| Progression logic: XP rules, levels, daily cap, milestone chest vouchers, title ids, tests | Claude | done (PR 1 of 2) |
| Profile and alias logic, online handshake fields, sanitising | Claude | done (PR 2 of 2) |
| Progression and profile art and screens (section 8) | Codex | planned |
| Veteran earn-only skin colourways, one per fighter | Codex | planned |
| Real portal SDK QA | Claude | planned |
| Music size and streaming decision | Claude | `?` |
| Balance sign-off | Owner | `?` |

## 7. Risks

- Content volume at launch is the main risk to retention (section 3).
- The gift skin uses one unique skin, so it is out of the chest pool for that player only.
- Dropping the free starter skins changes what existing testers see. Fine before launch.
- Portal terms differ (exclusivity, external requests). Read each before submitting.
- iPhone online play is unresolved.

## 8. Progression, profile and titles (spec)

Decided by the owner: one Boxer Level per device; XP from finished matches (vs AI, online and local VS all count); tokens only at milestone levels, never every level; earn-only skins; titles; a hard daily XP cap; a profile area; the title shown in online fights. No daily missions. Ranked is out of launch scope.

### XP and levels (numbers are proposals, tune with data)

| Source | XP |
| --- | --- |
| Finish a match vs AI | 10, plus 20 for a win. Easy x0.5, Normal x1, Hard x1.5 |
| Online match | 15 for finishing, plus 25 for a win |
| Local VS | 10 each, no win bonus |
| Training, tutorial | 0 |
| First launch fight | one fixed chunk, set in config |
| Daily hard cap | 300 XP per day (UTC day, same boundary as the shop). XP past the cap is lost, and the result screen says so |

XP to the next level = 100 + 25 x (level - 1). Level cap 50 for now (shows MAX).
Config lives in `src/progress/progress-config.json`, not in `tune.json` (it is not combat feel).

### Rewards on the track

| Kind | Rule |
| --- | --- |
| Tokens | Only as milestone chests: a free skin chest every 5 levels, a free fighter chest every 10 levels. These are chest vouchers, not loose tokens |
| Earn-only skins | One "Veteran" colourway per fighter, unlocked only by level, never in a chest. Cheap palette swaps |
| Titles | Text label from a fixed list, unlocked by level. Network and save store the title id, never free text |
| Frames and badges | Later. Frames are phase 2 |

Sample first 20 levels (placeholders): 2 Rookie title, 5 skin chest, 8 title, 10 fighter chest, 12 Veteran skin (Marco), 15 skin chest + title, 18 Veteran skin (Mia), 20 fighter chest + title.

### Profile and alias

- Profile screen (from the main menu): alias, level and XP bar, current title (changeable among unlocked), reward track with what is next, simple stats (matches, wins).
- Alias: use the portal's player name when the portal provides one (CrazyGames, Playgama). Otherwise a typed alias with a small in-canvas keyboard like the join keypad. Default is a generated "Boxer" + number.
- Alias rules (proposal): 3 to 12 characters, letters and digits only (any script), single spaces, no leading or trailing space, a small blocklist. Always sanitised again on the receiving side.
- Online: the alias and the title id are sent in the connection handshake. The receiver validates length, characters and that the title id exists, otherwise shows a default. No free text beyond the alias.
- The title shows under the character name in the VS intro, under the health bar, and on the victory screen (online matches; offline shows only your own).
- Poki and some portals restrict user-generated text. A build flag may force "generated alias only" on a portal that requires it.

### Work split

- Claude: save format, XP rules, level and reward logic, tests, alias validation, the handshake fields, analytics events, wiring tokens and chests into the shop state, the title ids. Interfaces below.
- Codex: all art and screen layouts (profile screen, XP bar, result XP fill, level-up reveal, title chip, frames, Veteran skin colourways).

### Interfaces Claude will provide (names may change; Codex builds against them)

`src/progress/progress.ts`: `loadProgress()`, `progressView()` returns `{ level, xp, xpToNext, capToday, xpToday, maxed, title, unlockedTitles, nextRewards }`, `awardMatch(result)` returns `{ xpGained, capped, levelUps: [{ level, rewards }] }`.
`src/progress/profile.ts`: `getAlias()`, `setAlias(raw)` returns `{ ok, alias } | { ok: false, reason }`, `getTitle()`, `setTitle(id)`, `sanitizeAlias(raw)`, `peerProfile(handshake)`.
`src/progress/titles.ts`: the title id list with `titleName(id)` going through `t()`.

### Built so far (logic only)

`src/progress/` holds `rules.ts` (pure rules), `progress.ts` (save and wiring), `titles.ts` and `progress-config.json`. XP is awarded once when a match finishes in vs AI, online, local VS and the first launch fight. The result is stored in the scene registry under `lastAward` for the result screen: `{ xpGained, capped, levelUps, grantedRewards }`. Milestone chests are saved as vouchers (`freeSkinChests`, `freeFighterChests`) and open for free in the Shop; the Shop button shows its badge while any voucher is waiting. Titles use placeholder ids (rookie, scrapper, brawler, contender, challenger, veteran, slugger, ringmaster, champion, legend) in `progress-config.json`; names are `title.<id>` keys. Veteran skin rewards point at `skin-<fighter>-veteran` ids at levels 12, 18, 24, 30, 36, 42 and 48; an id that does not exist yet is skipped until Codex adds the item (rename the ids in the config if Codex chooses others).

Pacing: level 50 needs about 34,300 XP in total, so about 114 days at the 300 XP daily cap.

### Built so far, profile and alias (logic only)

`src/progress/alias.ts` (pure rules), `alias.json` (limits, reserved names, offensive list) and `profile.ts` (save and wiring). `getAlias()` returns the typed alias, else the portal's player name, else a generated "Boxer 1234" kept for good. `setAlias(raw)` returns `{ ok: true, alias }` or `{ ok: false, reason }` with reason `short`, `long`, `chars`, `reserved` or `blocked` (Codex maps these to `t()` texts for the editor). The alias is never sent to analytics. `localWireProfile()` is `{ alias, title, level }`. The online `hello` message now carries it; `NetSession.peer` holds the opponent's profile after validation (alias re-sanitised, title id checked against the list, level clamped), with safe defaults for older clients. `sideProfiles(localIdx, peer)` returns the per-side profiles for the VS intro, the area under the health bar and the victory screen; offline, pass `null` for the bot. `PORTAL_FIXED_ALIAS=on` at build time makes the alias non-editable for portals that forbid user text. The portal `playerName()` hook exists but no adapter implements it yet.

Shop items can carry `earnOnly: true`: they never enter a chest or the daily offers, and are granted only by the level track. Use it for the Veteran skins.

Gap to fill: the `offensive` list in `alias.json` is empty. It should be filled for the six launch languages by the owner or through the translation sheet process before any portal submission.

### Open questions

- Daily cap of 300 XP: is that the right size? `?`
- Typed alias, generated alias or platform name only, per portal? `?`
- Title list and level for each title (owner to write; Claude proposes). `?`
- Do online opponents' aliases need a report or hide option? Without chat the risk is lower, but portal review may ask. `?`

## 9. Update log

- 2026-10-09: first-time experience built (Claude): easy fight vs Bruno, skip, Rising Star gift, free first skin chest, Shop badge.
- 2026-10-09: Tee moved into the fighter chest pool, welcome claim removed (Claude). The code in #274 already moved the starter skins into the chest pool and added Longan, Tyke, Dragon, McClassic and Flaming Kunoichi; Codex to fold them into section 5.
- 2026-10-09: owner decisions: first skin chest free, sparring partner Bruno, Tee no longer a free claim (Claude).
- 2026-10-09: created (Claude). Decisions from the owner: easy first fight, skippable, Rising Star gift, starter skins removed.

- 2026-10-09: Added the approved three runtime palettes per existing fighter (21 total), retained saved skin IDs, and reconciled shipped fighter/unique art inventory. Four future fighter portraits remain approval-only.
- 2026-10-09: added section 8, progression, profile and titles (Claude). Ranked pushed past launch.
- 2026-10-09: progression logic built, PR 1 of 2 (Claude): rules, daily cap, vouchers, titles, wiring into match ends. Profile and alias logic is PR 2.
- 2026-10-09: profile and alias logic built, PR 2 of 2 (Claude): alias rules, handshake fields, peer validation. Offensive word list still empty.
- 2026-10-09: ShopItem.earnOnly added so Veteran skins stay out of chests (Claude).
- 2026-10-09: skin chest pool now only offers skins for fighters the player owns (Claude). Note for the inventory: a fighter's skins only become obtainable after the fighter is owned.
