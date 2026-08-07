// Dev-only forced deals, used exclusively behind ?debug=1 to let Playwright
// exercise specific trick scenarios without relying on chance. None of this
// is reachable from normal play: main.ts only offers these on the
// name-entry screen when the debug flag is present, and initGame() only
// uses a forced deal when one is explicitly passed in.
import { CARD_DEFS, cardId } from './cards';
import type { CardId, ForcedDeal, God, Rank } from './types';

function assertValidDeal(name: string, deal: ForcedDeal): void {
  const all = deal.hands.flat();
  if (all.length !== 40) throw new Error(`debug scenario "${name}": expected 40 cards, got ${all.length}`);
  if (new Set(all).size !== 40) throw new Error(`debug scenario "${name}": duplicate card in deal`);
  const known = new Set(CARD_DEFS.map((c) => c.id));
  for (const id of all) {
    if (!known.has(id)) throw new Error(`debug scenario "${name}": unknown card id ${id}`);
  }
  for (const hand of deal.hands) {
    if (hand.length !== 10) throw new Error(`debug scenario "${name}": each hand must have 10 cards`);
  }
  if (new Set(deal.gods).size !== 4) throw new Error(`debug scenario "${name}": gods must be a 4-way bijection`);
}

const Y = (rank: Rank): CardId => cardId('YogSothoth', rank);
const C = (rank: Rank): CardId => cardId('Cthulhu', rank);
const S = (rank: Rank): CardId => cardId('ShubNiggurath', rank);
const N = (rank: Rank): CardId => cardId('Nyarlathotep', rank);

const DEFAULT_GODS: [God, God, God, God] = ['YogSothoth', 'Cthulhu', 'ShubNiggurath', 'Nyarlathotep'];

// Scenario A: no doubles. P0 leads Y2 (suit=Yog). P1 must follow Cthulhu,
// plays C10. P2 must follow Shub, plays SA -- since a 10 was already played
// this trick, the Ace counts as 11 and wins. P3 has zero Nyarlathotep cards
// and no rank pair, so is forced into a plain off-suit single. Exercises
// the Ace/10 interaction with no doubles anywhere.
const noDoubles: ForcedDeal = {
  leaderId: 0,
  gods: DEFAULT_GODS,
  hands: [
    [Y(2), N(3), N(4), N(5), N(6), N(7), N(8), N(9), N(10), N('Ace')],
    [C(10), C(3), C(4), C(5), C(6), C(7), C(8), C(9), C('Ace'), S(2)],
    [S('Ace'), S(3), S(4), S(5), S(6), S(7), S(8), S(9), S(10), N(2)],
    [Y(9), Y(3), Y(4), Y(5), Y(6), Y(7), Y(8), Y(10), Y('Ace'), C(2)],
  ],
};

// Scenario B: a single double wins. P0 leads Y2. P1 holds zero Cthulhu and
// a rank-9 pair (S9/N9) -- plays double-9. P2 follows Shub with S5. P3
// follows Nyarlathotep with N10 (the highest possible single). The double
// wins despite being numerically lower than P3's 10, since doubles always
// beat singles.
const singleDoubleWins: ForcedDeal = {
  leaderId: 0,
  gods: DEFAULT_GODS,
  hands: [
    [Y(2), Y(3), Y(4), Y(5), Y(6), Y(7), Y(8), Y(9), Y(10), Y('Ace')],
    [S(9), N(9), N(2), N(3), N(4), N(5), N(6), N(7), N(8), N('Ace')],
    [S(2), S(3), S(4), S(5), S(6), S(7), S(8), S(10), S('Ace'), C('Ace')],
    [N(10), C(2), C(3), C(4), C(5), C(6), C(7), C(8), C(9), C(10)],
  ],
};

// Scenario C: 2+ competing doubles. P0 leads Y2. P1 holds zero Cthulhu and
// a rank-6 pair -- plays double-6. P2 holds zero Shub and a rank-9 pair --
// plays double-9. P3 follows Nyarlathotep with N10 (a bystander single).
// The higher double (9) wins over the lower double (6), and both beat the
// single 10, regardless of its numeric rank.
const multiDoubleWins: ForcedDeal = {
  leaderId: 0,
  gods: DEFAULT_GODS,
  hands: [
    [Y(2), Y(3), Y(4), Y(5), Y(6), Y(7), Y(8), Y(9), Y(10), Y('Ace')],
    [S(2), S(3), S(4), S(5), S(6), S(7), S(8), S(9), S(10), N(6)],
    [C(9), C('Ace'), N(2), N(3), N(4), N(5), N(7), N(8), N(9), N('Ace')],
    [C(2), C(3), C(4), C(5), C(6), C(7), C(8), C(10), S('Ace'), N(10)],
  ],
};

// Scenario D: suit-completion win. P2 is secretly assigned Shub-Niggurath
// and starts holding 9 of the 10 Shub cards (missing S7, held by the
// leader P0). P0 leads S7; P1 follows Nyarlathotep; P2 follows Yog with its
// one Yog card (Y9); P3 follows Cthulhu. P2 has the highest rank (9) with
// no doubles in play, wins the trick, and collecting S7 completes all 10
// Shub cards in hand -- the win should fire immediately on collection,
// before any redistribution UI.
// trickNumber is bumped off 1 so the forced Blue-2 opener (only enforced on
// the very first trick of the game) doesn't block this scenario's S7 lead.
const suitCompletion: ForcedDeal = {
  leaderId: 0,
  gods: ['YogSothoth', 'Nyarlathotep', 'ShubNiggurath', 'Cthulhu'],
  trickNumber: 2,
  hands: [
    [Y(2), Y(3), Y(4), Y(5), Y(6), Y(7), Y(8), Y(10), Y('Ace'), S(7)],
    [N(2), N(3), N(4), N(5), N(6), N(7), N(8), N(9), N(10), N('Ace')],
    [S(2), S(3), S(4), S(5), S(6), S(8), S(9), S(10), S('Ace'), Y(9)],
    [C(2), C(3), C(4), C(5), C(6), C(7), C(8), C(9), C(10), C('Ace')],
  ],
};

// Scenario E: Role Revelation eligibility. Same layout as scenario A, but
// starting at trick 40 so the leader can immediately declare a role guess
// without playing 40 real tricks first.
const roleRevelation: ForcedDeal = {
  ...noDoubles,
  trickNumber: 40,
};

export const DEBUG_SCENARIOS: { key: string; label: string; deal: ForcedDeal }[] = [
  { key: 'no-doubles', label: 'Debug: no doubles', deal: noDoubles },
  { key: 'single-double', label: 'Debug: single double wins', deal: singleDoubleWins },
  { key: 'multi-double', label: 'Debug: 2+ doubles, highest wins', deal: multiDoubleWins },
  { key: 'suit-completion', label: 'Debug: suit-completion win', deal: suitCompletion },
  { key: 'role-revelation', label: 'Debug: trick 40, role guess available', deal: roleRevelation },
];

for (const { key, deal } of DEBUG_SCENARIOS) {
  assertValidDeal(key, deal);
}
