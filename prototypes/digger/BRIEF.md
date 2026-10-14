# Dice Dig

Replaces the previous digger game (archived as `prototypes/digger-legacy`).
Mobile-first, portrait, one-thumb play. The player taps one button to roll
dice. Dice damage tiles on a layered board, breaking tiles reveals treasure,
treasure is tapped to collect, gems buy upgrades.

## Core loop

1. Tap to roll dice.
2. Dice results damage tiles on the board.
3. Breaking tiles reveals treasures.
4. Player manually taps each discovered treasure to collect it.
5. Board cleared, move to the next board.
6. Spend gems on upgrades, repeat.

## Board

- Grid of 6 columns by 8 rows. 3 layers per cell. Treasures sit under the
  deepest layer.
- Each tile has health. Kinds: soft (hp 2, hardness 1), normal (hp 4,
  hardness 1), hardened (hp 8, hardness 2). Deeper layers multiply hp
  (x1, x1.5, x2) and layer 3 adds +1 hardness. All values live in `tune.json`.
- Some tiles are weak points (take x2 damage and ignore hardness).
- "Top layer" means the shallowest layer that still has an unbroken tile
  anywhere on the board.
- Board has limited total endurance (not built yet, see scope).
- Look: pseudo-3D. Placeholder shapes only. Rendering goes through a `Skin`
  interface (`src/render/skin.ts`) so the art style can be swapped without
  touching rules or scene code. Skins today: pastel (soft rounded beveled
  blocks, default), bevel (2.5D tilt), flat, iso. Pick one with `?skin=`.

## Tools

Player picks the tool with three buttons. Each roll uses a random dice count
in the tool's range. Each tool upgrades separately (later).

- Pickaxe: 1 to 3 dice, hardness tier 1
- Hammer: 4 to 9 dice, hardness tier 2
- C4: 10 to 20 dice, hardness tier 3

Hardness rule: a tool whose tier is below the tile's hardness only deals
`glancingDamage` (1) per hit, unless the tile is a weak point.

## Dice faces

- Miss: nothing
- Strike: 1 DMG to a random tile on the top-most layer
- Critical: 3 DMG to a random tile on the top-most layer
- Wild: 5 DMG to a random tile, any layer (hits the cell's current surface)
- Lucky: 5 DMG to a random top-layer tile that sits above a treasure
  (falls back to any top-layer tile when none is left)

Face weights are in `tune.json`.

## Energy and fairness (later)

Refresh tokens gate play. Pity score builds on missed rolls and improves later
results.

## Economy (later)

Gems from treasures. Gems buy base/ship and tool upgrades. Gold cap as a
spend sink.

## Flooding variant (later)

Each hit to board endurance may flood tiles. Flooded tiles can no longer be
mined. Build after the base board works.

## Scope order

1. One board, tap to roll, dice faces and damage working
2. Tile layers, health, hardened and weak points
3. Treasure reveal and manual tap-to-collect
4. Next board progression
5. Gem collection and tool upgrades
6. Refresh tokens and pity score
7. Gold cap
8. Flooding variant

Feel (juice, sounds, screen shake on Critical, Wild and Lucky) is tuned
before any later system is added.

## Out of scope

Raids, guild base view, relics, monetization, social features, backend.

## Success test

Tapping roll and breaking blocks feels satisfying enough that the player
wants one more tap.
