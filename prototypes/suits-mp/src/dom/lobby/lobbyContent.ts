// Ported verbatim from the Claude Design handoff (`Suit of Madness Lobby.dc.html`,
// selection.$preview / <script data-dc-script>). Copy, palette, and the
// error/subtitle tables are the design's; this file just gives them
// TypeScript types so LobbyFlow.tsx can consume them.

export const NUMERALS = ['I', 'II', 'III', 'IV'] as const;

export type ErrorKind = 'notFound' | 'connFailed' | 'timeout' | 'roomFull' | 'inProgress';

export interface ErrorContent {
  glyph: string;
  accent: string;
  tag: string;
  border: string;
  bg: string;
  inner: string;
  title: string;
  primary: string;
  detail: string;
}

export const ERRORS: Record<ErrorKind, ErrorContent> = {
  notFound: {
    glyph: '?',
    accent: 'oklch(0.86 0.09 84)',
    tag: 'ERR · ROOM_NOT_FOUND',
    border: 'rgba(198, 160, 78, 0.45)',
    bg: 'linear-gradient(180deg, rgba(34, 26, 12, 0.9), rgba(8, 12, 15, 0.92))',
    inner: 'rgba(120, 88, 30, 0.28)',
    title: 'No such circle',
    primary: 'Speak the sigil anew',
    detail: 'Those five marks answer to nothing. The sigil may be mistyped, or the circle has since closed.',
  },
  connFailed: {
    glyph: '⚡',
    accent: 'oklch(0.80 0.14 25)',
    tag: 'ERR · WEBRTC_FAILED · TURN exhausted',
    border: 'rgba(214, 106, 84, 0.45)',
    bg: 'linear-gradient(180deg, rgba(42, 18, 16, 0.9), rgba(10, 8, 10, 0.93))',
    inner: 'rgba(160, 60, 44, 0.26)',
    title: 'The thread will not hold',
    primary: 'Attempt the passage again',
    detail: 'Direct and relayed passages were both refused. A firewall or strict network may stand between you.',
  },
  timeout: {
    glyph: '◷',
    accent: 'oklch(0.84 0.06 178)',
    tag: 'ERR · TIMEOUT',
    border: 'rgba(120, 190, 178, 0.4)',
    bg: 'linear-gradient(180deg, rgba(10, 30, 32, 0.9), rgba(5, 11, 14, 0.93))',
    inner: 'rgba(28, 120, 116, 0.24)',
    title: 'Silence answered',
    primary: 'Call once more',
    detail: 'The circle did not reply in time. It may have gone quiet, or the host must re-announce the sigil.',
  },
  roomFull: {
    glyph: 'IV',
    accent: 'oklch(0.82 0.09 300)',
    tag: 'ERR · ROOM_FULL · 4/4',
    border: 'rgba(170, 132, 216, 0.45)',
    bg: 'linear-gradient(180deg, rgba(26, 18, 42, 0.9), rgba(8, 8, 14, 0.93))',
    inner: 'rgba(104, 58, 168, 0.28)',
    title: 'All four seats are taken',
    primary: 'Watch for a vacancy',
    detail: 'This circle is complete. Ask the host to release a thrall, or wait for a seat to empty.',
  },
  inProgress: {
    glyph: '✦',
    accent: 'oklch(0.86 0.09 84)',
    tag: 'ERR · GAME_IN_PROGRESS',
    border: 'rgba(198, 160, 78, 0.45)',
    bg: 'linear-gradient(180deg, rgba(34, 26, 12, 0.9), rgba(8, 12, 15, 0.92))',
    inner: 'rgba(120, 88, 30, 0.28)',
    title: 'The rite is under way',
    primary: 'Try the sigil again',
    detail: 'Cards are already dealt in this circle. Only a player rejoining their own seat may enter now.',
  },
};

export type Screen =
  | 'landing'
  | 'join'
  | 'joining'
  | 'lobby'
  | 'reconnecting'
  | 'waiting'
  | ErrorKind;

export const SUBTITLES: Record<Screen, string> = {
  landing: 'Four seats · one deal',
  join: 'Enter the sigil',
  joining: 'Crossing over',
  lobby: 'The circle gathers',
  reconnecting: 'Holding the thread',
  waiting: 'Bound to the circle',
  notFound: 'Turned away',
  connFailed: 'Turned away',
  timeout: 'Turned away',
  roomFull: 'Turned away',
  inProgress: 'Turned away',
};
