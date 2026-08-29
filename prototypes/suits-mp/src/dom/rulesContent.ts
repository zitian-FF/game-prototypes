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

export const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const;

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
    id: 'objective',
    tone: GOLD,
    title: 'The Objective',
    kicker: 'Why we sit',
    body: [
      "Each player is bound to a single god. Gather all ten cards of thy god's suit and thy covenant claims the victory.",
      'Two covenants contend: Chaos, of the drowned deeps, and Cosmos, of the gold and violet dark. Thy kin holds the other god of thy covenant — either of you completing a suit wins it for both.',
    ],
  },
  {
    id: 'cycle',
    tone: TEAL,
    title: 'The Turning of Suits',
    kicker: 'Order of the lead',
    isCycle: true,
    body: [
      'The suits lead in a fixed cycle. Each player must follow with the next suit in the sequence — the order is never chosen, only obeyed.',
    ],
  },
  {
    id: 'offsuit',
    tone: VIOLET,
    title: 'Straying from the Suit',
    kicker: 'When thou canst not follow',
    isOffSuit: true,
    body: [
      'Lacking the demanded suit, thou mayst lay a single card of any other suit — it is counted rank 0 and cannot take the trick.',
      'Or thou mayst lay a Twin Awakening: two cards of equal rank from any suits. A Twin may take the trick, and it binds thee to delegate the redistribution.',
    ],
  },
  {
    id: 'trick',
    tone: TEAL,
    title: 'Taking a Trick',
    kicker: 'Highest, and latest',
    body: [
      'The highest rank laid takes the trick. Where ranks are equal, the card played later prevails.',
      'The Ace overcomes a Ten only when it falls after it within the same trick. Laid before, the Ten stands.',
    ],
    note: 'Lateness is the tiebreaker throughout. Watch the order of play, not only the ranks.',
  },
  {
    id: 'redistribution',
    tone: GOLD,
    title: 'The Offerings',
    kicker: 'Redistribution',
    body: [
      'The taker gathers every card of the trick, then deals one card facedown to each player — as many cards as that player contributed.',
      'Won by a Twin Awakening, the redistribution is not thine to make: thou must delegate it to another player. Never thyself, and never declined.',
    ],
    note: 'Cards return facedown. Count what each player gave, and thou canst reason about what returns to them.',
  },
  {
    id: 'invoker',
    tone: GOLD,
    title: 'The Invoker',
    kicker: 'Who leads next',
    body: [
      'Whoever performed the redistribution of the previous trick leads the one that follows. The Invoker tag sits beside their name.',
    ],
  },
  {
    id: 'forty',
    tone: VIOLET,
    title: 'The Fortieth Trick',
    kicker: 'Forced ending',
    body: [
      'Should no suit be completed by the fortieth trick, the rite is closed by count. Each covenant is judged by its better player’s completion count, and the higher takes the victory.',
      'If those counts are equal, the other player of each covenant is compared. Should all counts match, the rite ends in stalemate.',
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
