import { getRelaySockets, joinRoom, type Room } from 'trystero/nostr';
import type { HashPacket, InputPacket } from './rollback';

// One Trystero room per 3-char code. The host is whoever created the room;
// it pairs with the first peer that says hello and turns any later peer
// away. Relays are pinned (see "Networking" in root CLAUDE.md).

const APP_ID = 'punchies';
const RELAY_URLS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.mostr.pub', 'wss://purplerelay.com', 'wss://nostr.data.haus'];

export type Role = 'host' | 'guest';

/** How many of the pinned signalling relays currently have an open connection (for the lobby's diagnostic line). */
export function relayStatus(): { open: number; total: number } {
  try {
    const sockets = Object.values(getRelaySockets() as Record<string, WebSocket>);
    return { open: sockets.filter((s) => s.readyState === 1).length, total: RELAY_URLS.length };
  } catch {
    return { open: 0, total: RELAY_URLS.length };
  }
}

export type CtlMessage =
  | { k: 'hello'; role: Role }
  | { k: 'full' }
  | { k: 'ping'; t: number }
  | { k: 'pong'; t: number }
  | { k: 'start'; round: number; delay: number; tune: string; chars: [string, string];skins?:[string,string] }
  | { k: 'pick'; char: string | null;hover?:string;skin?:string;available?:string[] }
  | { k: 'rematch'; round: number }
  | { k: 'reselect'; round: number }
  | { k: 'forfeit'; round: number }
  | { k: 'format'; bestOf: 1 | 3 };

// Trystero 0.25 actions: `send(data, { target })` and an assignable
// `onMessage(data, { peerId })`. Payload types are cast because our packet
// shapes are plain JSON but not declared with DataPayload's index signature.
interface Channel<T> {
  send(data: T, opts?: { target?: string }): Promise<unknown>;
  onMessage: ((data: T, context: { peerId: string }) => void) | null;
}

export class NetSession {
  private room: Room;
  private ctl: Channel<CtlMessage>;
  private inp: Channel<InputPacket>;
  private hsh: Channel<HashPacket>;
  peerId: string | null = null;

  onPaired: () => void = () => {};
  onPeerLeft: () => void = () => {};
  onCtl: (m: CtlMessage) => void = () => {};
  onInputs: (p: InputPacket) => void = () => {};
  onHash: (p: HashPacket) => void = () => {};
  onRejected: (reason: 'full' | 'collision') => void = () => {};

  constructor(
    readonly code: string,
    readonly role: Role,
    iceServers: RTCIceServer[] | undefined,
  ) {
    this.room = joinRoom({ appId: APP_ID, relayConfig: { urls: RELAY_URLS }, turnConfig: iceServers }, `room-${code}`);
    this.ctl = this.room.makeAction('ctl') as unknown as Channel<CtlMessage>;
    this.inp = this.room.makeAction('inp') as unknown as Channel<InputPacket>;
    this.hsh = this.room.makeAction('hsh') as unknown as Channel<HashPacket>;

    this.ctl.onMessage = (m, c) => this.handleCtl(m, c.peerId);
    this.inp.onMessage = (p, c) => {
      if (c.peerId === this.peerId) this.onInputs(p);
    };
    this.hsh.onMessage = (p, c) => {
      if (c.peerId === this.peerId) this.onHash(p);
    };

    this.room.onPeerJoin = (id: string) => {
      void this.ctl.send({ k: 'hello', role: this.role }, { target: id });
    };
    this.room.onPeerLeave = (id: string) => {
      if (id === this.peerId) {
        this.peerId = null;
        this.onPeerLeft();
      }
    };
  }

  private handleCtl(m: CtlMessage, from: string): void {
    if (m.k === 'hello') {
      if (m.role === this.role) {
        // Two hosts on one code: the room code collided.
        if (this.role === 'host' && !this.peerId) this.onRejected('collision');
        return;
      }
      if (this.peerId && this.peerId !== from) {
        if (this.role === 'host') void this.ctl.send({ k: 'full' }, { target: from });
        return;
      }
      if (!this.peerId) {
        this.peerId = from;
        this.onPaired();
      }
      return;
    }
    if (m.k === 'full') {
      if (!this.peerId) this.onRejected('full');
      return;
    }
    if (from === this.peerId) this.onCtl(m);
  }

  send(m: CtlMessage): void {
    if (this.peerId) void this.ctl.send(m, { target: this.peerId });
  }

  sendInputs(p: InputPacket): void {
    if (this.peerId) void this.inp.send(p, { target: this.peerId });
  }

  sendHash(p: HashPacket): void {
    if (this.peerId) void this.hsh.send(p, { target: this.peerId });
  }

  async forfeit(round:number): Promise<void> {
    if(this.peerId)await this.ctl.send({k:'forfeit',round},{target:this.peerId}).catch(()=>{});
  }

  leave(): void {
    void this.room.leave();
  }
}
