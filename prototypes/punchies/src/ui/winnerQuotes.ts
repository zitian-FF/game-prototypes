import { charName, isCharId } from '../sim/character';
const quotes = {
  marco: 'Catch me now. I’m only getting faster.',
  mia: 'You underestimated me. That was your first mistake.',
  bruno: 'Good round! Next time, try hitting back!',
  tee: 'All that noise. Still on the floor.',
};
export interface ResultWinner { char: string; skin?: string }
export function winnerQuote(char: string): string { return isCharId(char) ? quotes[char] : ''; }
export function winnerName(char: string): string { return charName(char); }
