// Excludes ambiguous characters (0/O, 1/I/L) since codes get read aloud,
// typed on phone keyboards, and copy-pasted between devices.
const LOBBY_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const LOBBY_CODE_LENGTH = 5;
const PUBLISHED_GAME_URL = 'https://zitian-ff.itch.io/suits-mp';

// Invite links must point to the published game even when a host opens a
// GitHub Pages or local preview build.
export function lobbyInviteUrl(code: string): string {
  return `${PUBLISHED_GAME_URL}?lobby=${encodeURIComponent(code)}`;
}

export function randomLobbyCode(): string {
  let code = '';
  for (let i = 0; i < LOBBY_CODE_LENGTH; i++) {
    code += LOBBY_CODE_CHARS[Math.floor(Math.random() * LOBBY_CODE_CHARS.length)];
  }
  return code;
}

export function isValidLobbyCode(code: string): boolean {
  if (code.length !== LOBBY_CODE_LENGTH) return false;
  return [...code].every((char) => LOBBY_CODE_CHARS.includes(char));
}

// Normalizes user-typed input the same way the input field forces it, so a
// pasted or lowercase code from a link still validates.
export function normalizeLobbyCode(raw: string): string {
  return raw.toUpperCase().replace(/\s+/g, '');
}
