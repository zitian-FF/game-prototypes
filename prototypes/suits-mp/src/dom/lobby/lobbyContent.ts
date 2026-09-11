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
    title: 'Room Not Found',
    primary: 'Enter Code Again',
    detail: 'Check the Room Code and try again. The Room may also have closed.',
  },
  connFailed: {
    glyph: '⚡',
    accent: 'oklch(0.80 0.14 25)',
    tag: 'ERR · WEBRTC_FAILED · TURN exhausted',
    border: 'rgba(214, 106, 84, 0.45)',
    bg: 'linear-gradient(180deg, rgba(42, 18, 16, 0.9), rgba(10, 8, 10, 0.93))',
    inner: 'rgba(160, 60, 44, 0.26)',
    title: 'Connection Failed',
    primary: 'Try Again',
    detail: "We couldn't connect to the Room. Check your internet connection or network settings, then try again.",
  },
  timeout: {
    glyph: '◷',
    accent: 'oklch(0.84 0.06 178)',
    tag: 'ERR · TIMEOUT',
    border: 'rgba(120, 190, 178, 0.4)',
    bg: 'linear-gradient(180deg, rgba(10, 30, 32, 0.9), rgba(5, 11, 14, 0.93))',
    inner: 'rgba(28, 120, 116, 0.24)',
    title: 'Room Did Not Respond',
    primary: 'Try Again',
    detail: 'The Room did not respond in time. Ask the Host to refresh the code, then try again.',
  },
  roomFull: {
    glyph: 'IV',
    accent: 'oklch(0.82 0.09 300)',
    tag: 'ERR · ROOM_FULL · 4/4',
    border: 'rgba(170, 132, 216, 0.45)',
    bg: 'linear-gradient(180deg, rgba(26, 18, 42, 0.9), rgba(8, 8, 14, 0.93))',
    inner: 'rgba(104, 58, 168, 0.28)',
    title: 'Room Full',
    primary: 'Try Again',
    detail: 'All four seats are occupied. Wait for a Player or Bot to leave before trying again.',
  },
  inProgress: {
    glyph: '✦',
    accent: 'oklch(0.86 0.09 84)',
    tag: 'ERR · GAME_IN_PROGRESS',
    border: 'rgba(198, 160, 78, 0.45)',
    bg: 'linear-gradient(180deg, rgba(34, 26, 12, 0.9), rgba(8, 12, 15, 0.92))',
    inner: 'rgba(120, 88, 30, 0.28)',
    title: 'Game Already Started',
    primary: 'Enter Another Code',
    detail: "This Room's Game has already started. Only Players reconnecting to their existing seat can join.",
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

// The 5 error kinds intentionally carry no subtitle at all now (see
// LobbyFlow.tsx's own masthead - it skips rendering this map's value
// entirely for an error screen) - kept as empty strings here rather than
// removed from the map so this stays a total `Record<Screen, string>` with
// no per-screen optionality to thread through every reader.
export const SUBTITLES: Record<Screen, string> = {
  // Landing shows only the baked-in logo art (see LobbyFlow.tsx's masthead)
  // - no separate subtitle text, so this is unused/never rendered; kept
  // empty for the same reason the error kinds are.
  landing: '',
  join: 'Join a Room',
  joining: 'Joining Room',
  lobby: 'Waiting for Players',
  reconnecting: 'Reconnecting',
  // Same copy as `lobby` above, deliberately - both mean "waiting for the
  // game to start," just from the host's vs. a joined peer's own
  // perspective respectively.
  waiting: 'Waiting for Players',
  notFound: '',
  connFailed: '',
  timeout: '',
  roomFull: '',
  inProgress: '',
};
