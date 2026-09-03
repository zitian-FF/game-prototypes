import type { CardDef, CardId, DeityCardState, God, Rank, Team } from './types';

// Reference data from the design document's card list table. Card names are
// flavour text only; they carry no mechanical meaning beyond god + rank.
const CARD_NAMES: Record<God, ReadonlyArray<readonly [Rank, string]>> = {
  Cthulhu: [
    [2, 'Tentacles'],
    [3, 'Dream-Drift'],
    [4, 'Drowned Cultist'],
    [5, "Murmurs from R'lyeh"],
    [6, 'Depthborn Servant'],
    [7, 'Ancient Leviathan'],
    [8, 'Abyssal Chant'],
    [9, 'Eye of the Sleeper'],
    [10, 'The Great Slumber'],
    ['DeityCard', 'Cthulhu'],
  ],
  Nyarlathotep: [
    [2, 'Whispering Masks'],
    [3, 'Mirage Walker'],
    [4, 'Cult of the Crawling Chaos'],
    [5, 'Black Wind'],
    [6, 'Veil of Illusions'],
    [7, 'Harbinger of Madness'],
    [8, 'Thousand Forms'],
    [9, 'Eyes in the Void'],
    [10, 'The Living Chaos'],
    ['DeityCard', 'Nyarlathotep'],
  ],
  ShubNiggurath: [
    [2, 'Root-Tangle Spawn'],
    [3, 'Bleeding Grove'],
    [4, "Goat's Whisper"],
    [5, 'Fertile Rot'],
    [6, 'Fungal Surge'],
    [7, 'The Thousand Young'],
    [8, 'Unnatural Bloom'],
    [9, 'Forest That Devours'],
    [10, "Black Goat's Awakening"],
    ['DeityCard', 'Shub-Niggurath'],
  ],
  YogSothoth: [
    [2, 'Flicker of the Void'],
    [3, 'Timeless Observer'],
    [4, 'Astral Pulse'],
    [5, 'Orb-Watcher'],
    [6, 'Portal Lattice'],
    [7, 'Voice Through Dimensions'],
    [8, 'Keeper of Keys'],
    [9, 'Star-Fused Knowledge'],
    [10, 'Gate Beyond All Time'],
    ['DeityCard', 'Yog-Sothoth'],
  ],
};

export const GOD_DISPLAY_NAME: Record<God, string> = {
  Cthulhu: 'Cthulhu',
  Nyarlathotep: 'Nyarlathotep',
  ShubNiggurath: 'Shub-Niggurath',
  YogSothoth: 'Yog-Sothoth',
};

// Player-facing name for a god's Deity Card, per its current Dormant/Powered
// state (see rules/types.ts's DeityCardState). Exposed here for the
// rendering layer to consume later - not yet wired into any UI.
export function deityCardDisplayName(god: God, state: DeityCardState): string {
  return state === 'powered' ? `Awakened ${GOD_DISPLAY_NAME[god]}` : GOD_DISPLAY_NAME[god];
}

// Short codes for space-constrained UI (the card-fan boxes and Suit Cycle
// HUD ring nodes are too small for GOD_DISPLAY_NAME's full names).
export const GOD_ABBR: Record<God, string> = {
  Cthulhu: 'CTH',
  Nyarlathotep: 'NYA',
  ShubNiggurath: 'SHU',
  YogSothoth: 'YOG',
};

export const GOD_TEAM: Record<God, Team> = {
  Cthulhu: 'Chaos',
  Nyarlathotep: 'Chaos',
  ShubNiggurath: 'Cosmos',
  YogSothoth: 'Cosmos',
};

// Fixed suit rotation cycle: Yog-Sothoth -> Cthulhu -> Shub-Niggurath ->
// Nyarlathotep -> repeat.
export const SUIT_CYCLE: readonly God[] = ['YogSothoth', 'Cthulhu', 'ShubNiggurath', 'Nyarlathotep'];

export const ALL_GODS: readonly God[] = SUIT_CYCLE;

// Teams are fixed god-pairs, so knowing your own god always tells you your
// teammate's god (not their identity, just which colour to look for).
export const TEAMMATE_GOD: Record<God, God> = {
  Cthulhu: 'Nyarlathotep',
  Nyarlathotep: 'Cthulhu',
  ShubNiggurath: 'YogSothoth',
  YogSothoth: 'ShubNiggurath',
};

const RANK_SORT_ORDER: Record<Rank, number> = {
  2: 0,
  3: 1,
  4: 2,
  5: 3,
  6: 4,
  7: 5,
  8: 6,
  9: 7,
  10: 8,
  DeityCard: 9,
};

export function cardId(god: God, rank: Rank): string {
  return `${god}-${rank}`;
}

export const CARD_DEFS: readonly CardDef[] = (Object.keys(CARD_NAMES) as God[]).flatMap((god) =>
  CARD_NAMES[god].map(([rank, name]) => ({
    id: cardId(god, rank),
    god,
    rank,
    name,
  }))
);

const CARD_BY_ID: ReadonlyMap<string, CardDef> = new Map(CARD_DEFS.map((c) => [c.id, c]));

export function cardById(id: string): CardDef {
  const card = CARD_BY_ID.get(id);
  if (!card) throw new Error(`unknown card id: ${id}`);
  return card;
}

export function nextSuit(god: God): God {
  const idx = SUIT_CYCLE.indexOf(god);
  return SUIT_CYCLE[(idx + 1) % SUIT_CYCLE.length];
}

export function suitAfterSteps(god: God, steps: number): God {
  const idx = SUIT_CYCLE.indexOf(god);
  return SUIT_CYCLE[(idx + steps) % SUIT_CYCLE.length];
}

// Display-only ordering: groups a hand by suit (in SUIT_CYCLE order), then
// ascending rank within each suit. Never mutates or reorders game state —
// callers pass the result straight to rendering.
export function sortCardIds(ids: readonly CardId[]): CardId[] {
  return [...ids].sort((a, b) => {
    const cardA = cardById(a);
    const cardB = cardById(b);
    const suitDiff = SUIT_CYCLE.indexOf(cardA.god) - SUIT_CYCLE.indexOf(cardB.god);
    if (suitDiff !== 0) return suitDiff;
    return RANK_SORT_ORDER[cardA.rank] - RANK_SORT_ORDER[cardB.rank];
  });
}

// Display-only ordering: ascending rank first, ties broken by SUIT_CYCLE
// order for a stable, deterministic fan layout (the brief's Sort button
// offers only this and sortCardIds, both ascending-only - see BRIEF.md's
// "Sort button" section). Never mutates or reorders game state.
export function sortCardIdsByRank(ids: readonly CardId[]): CardId[] {
  return [...ids].sort((a, b) => {
    const cardA = cardById(a);
    const cardB = cardById(b);
    const rankDiff = RANK_SORT_ORDER[cardA.rank] - RANK_SORT_ORDER[cardB.rank];
    if (rankDiff !== 0) return rankDiff;
    return SUIT_CYCLE.indexOf(cardA.god) - SUIT_CYCLE.indexOf(cardB.god);
  });
}
