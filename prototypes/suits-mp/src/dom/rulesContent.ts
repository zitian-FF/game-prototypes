// Ported verbatim from the Claude Design handoff (`Suit of Madness Rules.dc.html`,
// selection.$preview / <script data-dc-script>). Copy and structure are the
// design's; this file just gives them TypeScript types so RulesModal.tsx can
// consume them.

import type { God } from '../rules/types';

export interface Tone {
  accent: string;
  dim: string;
  soft: string;
  line: string;
  bg: string;
}

export const GOLD: Tone = {
  accent: 'oklch(0.86 0.09 84)',
  dim: 'rgba(198, 160, 78, 0.45)',
  soft: 'rgba(212, 186, 132, 0.6)',
  line: 'rgba(198, 160, 78, 0.28)',
  bg: 'linear-gradient(180deg, rgba(26, 21, 10, 0.66), rgba(6, 11, 14, 0.6))',
};

export const TEAL: Tone = {
  accent: 'oklch(0.84 0.07 178)',
  dim: 'rgba(120, 190, 178, 0.45)',
  soft: 'rgba(158, 206, 196, 0.6)',
  line: 'rgba(120, 190, 178, 0.26)',
  bg: 'linear-gradient(180deg, rgba(8, 26, 28, 0.66), rgba(5, 10, 13, 0.6))',
};

export const VIOLET: Tone = {
  accent: 'oklch(0.84 0.09 300)',
  dim: 'rgba(170, 132, 216, 0.45)',
  soft: 'rgba(196, 174, 232, 0.6)',
  line: 'rgba(170, 132, 216, 0.26)',
  bg: 'linear-gradient(180deg, rgba(20, 15, 34, 0.68), rgba(6, 8, 13, 0.6))',
};

export const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI'] as const;

export interface RuleSection {
  id: string;
  tone: Tone;
  title: string;
  kicker: string;
  body: string[];
  isCycle?: boolean;
  isOffSuit?: boolean;
  note?: string;
}

export const SECTIONS: RuleSection[] = [
  {
    id: 'goal',
    tone: GOLD,
    title: 'Goal',
    kicker: '',
    body: [
      'Your Deity and Team are secret.',
      'Find your teammate through play.',
      'Help yourself or your teammate collect all 10 cards of their Deity Suit.',
      'Complete either Deity Suit: your Team wins.',
    ],
  },
  {
    id: 'start',
    tone: TEAL,
    title: 'Start',
    kicker: '',
    body: [
      '4 Players. 4 Deities. 10 cards each.',
      'Holder of the 2 of Yog-Sothoth leads the first Trick with that card.',
      'Play clockwise.',
    ],
  },
  {
    id: 'playCard',
    tone: VIOLET,
    title: 'Play a Card',
    kicker: '',
    isCycle: true,
    isOffSuit: true,
    body: [
      'First card: sets the Lead Suit.',
      'Each next Player: Required Suit moves one step around the Suit Cycle.',
      'Have the Required Suit: play 1 card of that Suit.',
      'No Required Suit: choose one:',
      'Off-suit Single, face down. Rank 0. Cannot win. Its suit, rank, and Deity stay hidden from every other player.',
      'Double: 2 cards of the same rank, any Suits.',
    ],
  },
  {
    id: 'winTrick',
    tone: GOLD,
    title: 'Win the Trick',
    kicker: '',
    body: [
      'Any Double beats every Single.',
      'Highest rank wins.',
      'Same rank: latest play wins.',
      "Deity Card: Dormant, rank 1, marked '1'.",
      "Any 10 played earlier in the Trick: later Deity Cards become Powered, marked '★', rank 11.",
      '10 played later: no effect on an earlier Deity Card.',
    ],
  },
  {
    id: 'redistribute',
    tone: TEAL,
    title: 'Redistribute',
    kicker: '',
    body: [
      'Single wins: winner redistributes the Trick cards.',
      'Double wins: winner chooses another Player as Delegate (never themselves).',
      'Delegate receives the Trick cards and redistributes them.',
      'Cards returned face down.',
      'Each Player receives the same number of cards they played.',
      'Everyone ends with 10 cards.',
      'Redistributor leads the next Trick with 1 card.',
    ],
  },
  {
    id: 'endGame',
    tone: VIOLET,
    title: 'End the Game',
    kicker: '',
    body: [
      'Check for victory after redistribution.',
      "Full Deity Suit: that Player's Team wins.",
      'Both Teams complete a Suit together: stalemate.',
      'No Trick limit. Play until a win or stalemate.',
    ],
  },
];

export type CycleTone = 'gold' | 'teal';

export interface CycleGod {
  code: string;
  name: string;
  team: string;
  tone: CycleTone;
  god: God;
}

export const CYCLE: CycleGod[] = [
  { code: 'YS', name: 'Yog-Sothoth', team: 'Cosmos', tone: 'gold', god: 'YogSothoth' },
  { code: 'CT', name: 'Cthulhu', team: 'Chaos', tone: 'teal', god: 'Cthulhu' },
  { code: 'SN', name: 'Shub-Niggurath', team: 'Cosmos', tone: 'gold', god: 'ShubNiggurath' },
  { code: 'NY', name: 'Nyarlathotep', team: 'Chaos', tone: 'teal', god: 'Nyarlathotep' },
];

export function cycleBorder(tone: CycleTone): string {
  return tone === 'gold' ? 'rgba(198, 160, 78, 0.55)' : 'rgba(120, 190, 178, 0.5)';
}

export function cycleBg(tone: CycleTone): string {
  return tone === 'gold' ? 'rgba(48, 36, 12, 0.6)' : 'rgba(10, 44, 44, 0.6)';
}

export function cycleTeamColor(tone: CycleTone): string {
  return tone === 'gold' ? 'rgba(212, 186, 132, 0.7)' : 'rgba(158, 206, 196, 0.7)';
}
