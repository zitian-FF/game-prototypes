import { NUMERALS } from './lobbyContent';

// Ported from the design's `seatModel()` method. Placeholder-data only:
// "peer" here is a hardcoded display name, not a real connected roster
// entry - see BUILD_STATUS.md for why real roster/networking binding is
// deferred to a future task.
export type SeatOccupancy = 'host' | 'peer' | 'bot' | null;

export interface SeatViewModel {
  id: string;
  numeral: string;
  state: 'empty' | SeatOccupancy;
  name: string;
  role: string;
  glyph: string;
  line: string;
  bg: string;
  numColor: string;
  dotColor: string;
  nameColor: string;
  roleColor: string;
  canFill: boolean;
  canRelease: boolean;
  fill: () => void;
  release: () => void;
}

const NAMES = { host: 'Randolph C.', peer: 'Erich Z.' };

export function seatModel(
  occupancy: SeatOccupancy[],
  onFill: (index: number) => void,
  onRelease: (index: number) => void,
): SeatViewModel[] {
  return occupancy.map((occ, i) => {
    const filled = occ !== null;
    const isBot = occ === 'bot';
    const isHost = occ === 'host';
    const accent = isBot ? 'rgba(170, 132, 216,' : isHost ? 'rgba(198, 160, 78,' : 'rgba(120, 190, 178,';
    return {
      id: 'seat' + (i + 1),
      numeral: NUMERALS[i],
      state: occ === null ? 'empty' : occ,
      name: isBot ? 'Thrall of the Deep' : isHost ? NAMES.host : occ === 'peer' ? NAMES.peer : 'Awaiting a soul',
      role: isBot ? 'Bot · bound by the host' : isHost ? 'Host · thee' : occ === 'peer' ? 'Player · connected' : 'Empty seat',
      glyph: filled ? (isBot ? '✦' : '◆') : '◇',
      line: filled ? accent + ' 0.34)' : 'rgba(158, 196, 186, 0.14)',
      bg: filled
        ? isBot
          ? 'linear-gradient(180deg, rgba(24, 18, 40, 0.86), rgba(8, 8, 14, 0.9))'
          : isHost
            ? 'linear-gradient(180deg, rgba(38, 30, 12, 0.86), rgba(8, 11, 14, 0.9))'
            : 'linear-gradient(180deg, rgba(10, 32, 34, 0.86), rgba(5, 11, 14, 0.9))'
        : 'rgba(6, 12, 15, 0.55)',
      numColor: filled ? accent + ' 0.8)' : 'rgba(158, 196, 186, 0.35)',
      dotColor: filled ? accent + ' 0.9)' : 'rgba(158, 196, 186, 0.3)',
      nameColor: filled ? 'oklch(0.92 0.02 100)' : 'rgba(170, 200, 194, 0.42)',
      roleColor: filled ? accent + ' 0.65)' : 'rgba(158, 196, 186, 0.32)',
      canFill: occ === null,
      canRelease: isBot,
      fill: () => onFill(i),
      release: () => onRelease(i),
    };
  });
}
