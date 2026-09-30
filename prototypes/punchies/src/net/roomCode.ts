// 3-character room codes. Excludes look-alikes (0/O, 1/I/L) so codes read
// cleanly off a screen.
export const ROOM_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function randomRoomCode(): string {
  let s = '';
  for (let i = 0; i < 3; i++) s += ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)];
  return s;
}

export function normalizeRoomCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const code = raw.trim().toUpperCase().replace(/O/g, '0').replace(/[^A-Z0-9]/g, '');
  if (code.length !== 3) return null;
  for (const ch of code) if (!ROOM_ALPHABET.includes(ch)) return null;
  return code;
}

// Game URL with the room code attached, for the QR code / share link.
export function roomUrl(code: string): string {
  return `${location.origin}${location.pathname}?room=${code}`;
}

export function roomFromUrl(): string | null {
  return normalizeRoomCode(new URLSearchParams(location.search).get('room'));
}
