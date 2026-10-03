import { PROTOCOL_VERSION, applyPatch } from 'firestorm-net';
import type { ClientEvent, ClientMsg, CommandBody, LobbyPlayer, MatchStartInfo, RoomPhase, ServerMsg, WireView } from 'firestorm-net';
import type { MatchResult } from 'arena-sim';
import { clientTune } from '../clientTune';

const SAVE_KEY = 'firestorm-arena:save:v1';
const ROOM_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

interface Save {
  clientId: string;
  name: string;
  room?: string;
}

function loadSave(): Save {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as Save;
      if (typeof s.clientId === 'string' && typeof s.name === 'string') return s;
    }
  } catch {
    /* storage can be blocked: fall through to a fresh identity */
  }
  return { clientId: randomId(), name: '' };
}

function randomId(): string {
  const a = new Uint8Array(12);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomRoomCode(): string {
  const a = new Uint8Array(3);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => ROOM_ALPHABET[b % ROOM_ALPHABET.length]).join('');
}

export function normalizeRoomCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
}

const DEPLOYED_SERVER = 'wss://firestorm-arena-server.tianz-88.workers.dev';

export function serverBase(): string {
  const params = new URLSearchParams(location.search);
  const fromQuery = params.get('server');
  if (fromQuery) return fromQuery.replace(/\/$/, '');
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  if (env?.VITE_SERVER_URL) return env.VITE_SERVER_URL.replace(/\/$/, '');
  // Local play talks to a local `wrangler dev`; anywhere else (GitHub Pages, itch) to the deployed Worker.
  const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  return local ? 'ws://127.0.0.1:8787' : DEPLOYED_SERVER;
}

export interface LobbyState {
  phase: RoomPhase;
  hostId: string | null;
  players: LobbyPlayer[];
  maxPlayers: number;
  countdownEndsAtMs?: number;
  fillBots: boolean;
  minutes: number;
}

export type Toast = { text: string; kind: 'info' | 'good' | 'bad'; until: number };

/**
 * Everything the screens need to know about the connection and the match.
 * Owns the socket, keeps the current WireView up to date and the server clock.
 */
export class Session {
  save: Save = loadSave();
  socket: WebSocket | null = null;
  status: 'idle' | 'connecting' | 'open' | 'reconnecting' = 'idle';
  error = '';
  room = '';
  isHost = false;
  lobby: LobbyState | null = null;
  info: MatchStartInfo | null = null;
  view: WireView | null = null;
  result: MatchResult | null = null;
  toasts: Toast[] = [];
  /** Events from the latest state messages, drained by the game scene. */
  pendingEvents: ClientEvent[] = [];
  private creating = false;
  private serverOffset = 0;
  private bestRtt = Infinity;
  private pingTimer = 0;
  private reconnectTimer = 0;
  private wantOpen = false;
  private nextCmdId = 1;
  private lastSim = 0;

  get name(): string {
    return this.save.name;
  }

  setName(name: string): void {
    this.save.name = name;
    this.persist();
  }

  private persist(): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.save));
    } catch {
      /* private mode: the identity just will not survive a reload */
    }
  }

  // ------------------------------------------------------------- connection

  connect(room: string, create: boolean): void {
    this.leave();
    this.error = '';
    this.room = room;
    this.creating = create;
    this.wantOpen = true;
    this.status = 'connecting';
    this.save.room = room;
    this.persist();
    this.open();
  }

  private open(): void {
    // Only creating a room is checked against the daily limits; joining or reconnecting never is.
    const url = `${serverBase()}/ws/${this.room}${this.creating ? '?create=1' : ''}`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      this.fail('Could not open a connection.');
      return;
    }
    this.socket = ws;
    ws.onopen = () => {
      this.send({ t: 'hello', v: PROTOCOL_VERSION, clientId: this.save.clientId, name: this.save.name, create: this.creating });
      this.creating = false;
    };
    ws.onmessage = (ev) => {
      if (typeof ev.data === 'string') this.onMessage(JSON.parse(ev.data) as ServerMsg);
    };
    ws.onclose = () => {
      if (this.socket !== ws) return;
      this.socket = null;
      window.clearInterval(this.pingTimer);
      if (!this.wantOpen) return;
      if (this.status === 'open' && (this.info || this.lobby)) {
        this.status = 'reconnecting';
        this.reconnectTimer = window.setTimeout(() => this.open(), clientTune.net.reconnectDelayMs);
      } else if (this.status === 'connecting' && !this.error) {
        this.fail('Could not reach the server.');
      }
    };
    ws.onerror = () => {
      /* onclose follows and reports it */
    };
  }

  private fail(message: string): void {
    this.error = message;
    this.wantOpen = false;
    this.status = 'idle';
  }

  /** Forget the saved name, identity and room (this browser only). */
  resetSaved(): void {
    this.leave();
    this.error = '';
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* nothing stored */
    }
    this.save = loadSave();
  }

  /** Host: end the room for everyone (frees the code). Anyone else: just leave. */
  finish(): void {
    if (this.isHost) this.send({ t: 'endRoom' });
    this.leave();
  }

  leave(): void {
    this.wantOpen = false;
    window.clearTimeout(this.reconnectTimer);
    window.clearInterval(this.pingTimer);
    const ws = this.socket;
    this.socket = null;
    if (ws) ws.close();
    this.status = 'idle';
    this.lobby = null;
    this.info = null;
    this.view = null;
    this.result = null;
    this.pendingEvents = [];
    this.toasts = [];
    this.isHost = false;
    this.lastSim = 0;
    this.bestRtt = Infinity;
  }

  send(msg: ClientMsg): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(msg));
  }

  sendCommand(cmd: CommandBody): void {
    this.send({ t: 'cmd', id: this.nextCmdId++, cmd });
  }

  // --------------------------------------------------------------- messages

  private onMessage(msg: ServerMsg): void {
    switch (msg.t) {
      case 'welcome':
        this.status = 'open';
        this.isHost = msg.isHost;
        this.serverOffset = msg.serverNow - Date.now();
        window.clearInterval(this.pingTimer);
        this.pingTimer = window.setInterval(() => this.ping(), clientTune.net.pingEverySeconds * 1000);
        this.ping();
        break;
      case 'lobby':
        this.lobby = {
          phase: msg.phase,
          hostId: msg.hostId,
          players: msg.players,
          maxPlayers: msg.maxPlayers,
          countdownEndsAtMs: msg.countdownEndsAtMs,
          fillBots: msg.fillBots,
          minutes: msg.minutes,
        };
        this.isHost = msg.hostId === this.save.clientId;
        break;
      case 'error':
        if (msg.code === 'replaced') this.error = 'This game was opened in another tab.';
        else this.error = msg.message;
        if (msg.code !== 'rateLimited' && msg.code !== 'badPhase' && msg.code !== 'notHost' && msg.code !== 'teamFull') {
          const message = this.error;
          this.leave(); // drops match state too, so screens fall back to the menu
          this.error = message;
        }
        else this.toast(msg.message, 'bad');
        break;
      case 'matchStart':
        this.info = msg.info;
        this.view = null;
        this.result = null;
        break;
      case 'state': {
        if (this.bestRtt === Infinity) this.serverOffset = msg.serverNow - Date.now(); // until a ping measures latency
        if (msg.full && msg.view) this.view = msg.view;
        else if (msg.patch && this.view) this.view = applyPatch(this.view, msg.patch);
        for (const e of msg.events) {
          this.pendingEvents.push(e);
          if (e.type === 'matchEnded') this.result = e.result;
        }
        break;
      }
      case 'cmdResult':
        if (!msg.ok) this.toast(describeError(msg.error), 'bad');
        break;
      case 'pong': {
        const rtt = Date.now() - msg.c;
        if (rtt <= this.bestRtt * 1.5 || this.bestRtt === Infinity) {
          this.bestRtt = Math.min(this.bestRtt, rtt);
          this.serverOffset = msg.s + rtt / 2 - Date.now();
        }
        break;
      }
    }
  }

  private ping(): void {
    this.send({ t: 'ping', c: Date.now() });
  }

  // ------------------------------------------------------------------ clock

  serverNow(): number {
    return Date.now() + this.serverOffset;
  }

  /** Estimated current sim time in ms, never running backwards. */
  simNow(): number {
    const info = this.info;
    if (!info) return 0;
    const est = Math.max(0, (this.serverNow() - info.startedAtServerMs) * info.timeScale);
    const floor = this.view ? this.view.timeMs : 0;
    let t = Math.max(est, floor);
    if (t < this.lastSim && this.lastSim - t < 1500) t = this.lastSim;
    this.lastSim = t;
    return t;
  }

  // ------------------------------------------------------------------ toasts

  toast(text: string, kind: Toast['kind'] = 'info'): void {
    this.toasts.push({ text, kind, until: Date.now() + clientTune.hud.toastSeconds * 1000 });
    if (this.toasts.length > 5) this.toasts.shift();
  }
}

const ERRORS: Record<string, string> = {
  unknownSquad: 'Unknown squad.',
  alreadyMarching: 'That squad is already marching.',
  noTroops: 'That squad has no troops left.',
  alreadyThere: 'Already there.',
  ownHq: 'That is your own HQ.',
  allyHq: 'That HQ is an ally.',
  safeZone: 'An HQ in a safe zone cannot be attacked.',
  notMarching: 'That squad is not marching.',
  alreadyReturning: 'That squad is already heading home.',
  notAtHq: 'Squads in the field can only be told to return to HQ.',
  alreadyHome: 'That squad is already at the HQ.',
  notControlled: 'You can only teleport to a node your team holds.',
  onCooldown: 'Teleport is still recharging.',
  noFreeSlot: 'No free base slot at that node.',
  scoutBusy: 'That scout is already out.',
  matchEnded: 'The match is over.',
};

function describeError(code?: string): string {
  if (!code) return 'Order refused.';
  return ERRORS[code] ?? `Order refused (${code}).`;
}

export const session = new Session();
