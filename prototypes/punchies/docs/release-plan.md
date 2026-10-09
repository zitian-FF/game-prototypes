# Punchies release plan and content roadmap

Live document. Claude owns the plan sections. Codex keeps the inventory tables
(section 5) up to date as art lands. The owner decides. Change this file by pull
request and add a line to the update log (section 8) every time.

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
| G.P. Tee | `tee` | Glass Cannon | Fighter chest (no longer a free claim) | `?` | `?` | Hidden in roster until owned |
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
| Rising Star | `skin-marco-unique` | Marco | unique | First-run gift | `?` | Portrait key `portrait_marco_rising_star`, rig `marco_rising_star` |
| Ring Captain | `skin-mia-unique` | Mia | unique | Skin chest | `?` | Portrait key `portrait_mia_ring_captain`, rig `mia_ring_captain` |
| Old Champ | `skin-bruno-unique` | Bruno | unique | Skin chest | `?` | Portrait key `portrait_bruno_old_champ`, rig `bruno_old_champ` |
| Cyan Rush | `skin-marco-cyan` | Marco | palette | Skin chest (was free starter) | done | |
| Violet Resolve | `skin-mia-violet` | Mia | palette | Skin chest (was free starter) | done | |
| Golden Veteran | `skin-bruno-gold` | Bruno | palette | Skin chest (was free starter) | done | |
| Night Shift | `skin-marco` | Marco | palette | Skin chest | `?` | |
| Scarlet Spark | `skin-mia` | Mia | palette | Skin chest | `?` | |
| Old Gold | `skin-bruno` | Bruno | palette | Skin chest | `?` | |
| (none yet) | | Tee | | | | Tee has no skins listed |

Totals today: 4 playable fighters (3 owned, Tee from the fighter chest), 2 placeholder fighters, 9 skins in
the pool plus the gift.

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
| First-time experience (flow, easy fight vs Bruno, skip, Rising Star reveal, free first skin chest, welcome card, Shop badge) | Claude | planned |
| Remove the free Tee claim: Tee joins the fighter chest pool, welcome claim UI removed, existing owners keep him | Claude | done |
| Starter alternate skins join the chest pool; nobody gets them free | Codex (#274) | done |
| Data-driven palette swaps (table per skin) so new palette skins need no code | Claude with Codex | planned |
| Unique skin art and rigs (Rising Star, Ring Captain, Old Champ) | Codex | `?` |
| Tee portrait and rig confirmed final | Codex | `?` |
| Fighters five and six: design, stats, art | Owner, Codex | `?` |
| Translation sheet created, published, pulled, reviewed | Codex, owner (Chinese) | in progress |
| iPhone online play fix | Claude, with owner retest | blocked on owner retest |
| Real portal SDK QA | Claude | planned |
| Music size and streaming decision | Claude | `?` |
| Balance sign-off | Owner | `?` |

## 7. Risks

- Content volume at launch is the main risk to retention (section 3).
- The gift skin uses one unique skin, so it is out of the chest pool for that player only.
- Dropping the free starter skins changes what existing testers see. Fine before launch.
- Portal terms differ (exclusivity, external requests). Read each before submitting.
- iPhone online play is unresolved.

## 8. Update log

- 2026-10-09: Tee moved into the fighter chest pool, welcome claim removed (Claude). The code in #274 already moved the starter skins into the chest pool and added Longan, Tyke, Dragon, McClassic and Flaming Kunoichi; Codex to fold them into section 5.
- 2026-10-09: owner decisions: first skin chest free, sparring partner Bruno, Tee no longer a free claim (Claude).
- 2026-10-09: created (Claude). Decisions from the owner: easy first fight, skippable, Rising Star gift, starter skins removed.
