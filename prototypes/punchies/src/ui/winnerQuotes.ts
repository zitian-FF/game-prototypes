import { t } from '../i18n';
import { charName, isCharId } from '../sim/character';
export interface ResultWinner { char: string; skin?: string }
export function winnerQuote(char: string): string { return isCharId(char) ? t(`quote.${char}`) : ''; }
export function winnerName(char: string): string { return charName(char); }
