import {currentRating,loadRating,createRatingMatch,reportRating} from './rating';
import { getRelaySockets, joinRoom, type Room } from 'trystero/nostr';
import type { HashPacket, InputPacket } from './rollback';
import { localWireProfile, peerProfile } from '../progress/profile';
import type { WireProfile } from '../progress/alias';

// One Trystero room per 3-char code. The host is whoever created the room;
// it prefers the closest rating among simultaneous guests and turns later peers
// away. Relays are pinned (see "Networking" in root CLAUDE.md).

const APP_ID = 'punchies';
const RELAY_URLS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.mostr.pub', 'wss://purplerelay.com', 'wss://nostr.data.haus'];

export type Role = 'host' | 'guest';
function peerRating(value:unknown):{id:string;points:number}|null {
 const r=value as {id:string;points:number};
 return r&&typeof r.id==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(r.id)&&Number.isSafeInteger(r.points)&&r.points>=0?r:null;
}

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
  | { k: 'hello'; role: Role; rated?:boolean; profile?: WireProfile; rating?:{id:string;points:number} }
  | { k: 'ratingSet';nonce:string }
  | { k:'paired';rated?:boolean;profile?:WireProfile;rating?:{id:string;points:number} }
  | { k: 'full' }
  | { k: 'ping'; t: number }
  | { k: 'pong'; t: number }
  | { k: 'start'; rated?:boolean; round: number; delay: number; tune: string; chars: [string, string];skins?:[string,string];ratingNonce?:string }
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
  peerRating:{id:string;points:number}|null=null;
  ratingMatch:Promise<string|null>=Promise.resolve(null);
  private candidates=new Map<string,CtlMessage & {k:'hello'}>();
  private pairingTimer:ReturnType<typeof setTimeout>|undefined;
  private closed=false;private initialQueueNonceUsed=false;
  nextRatingNonce():string {if(this.assignment&&!this.initialQueueNonceUsed){this.initialQueueNonceUsed=true;return this.assignment.nonce;}return crypto.randomUUID();}
  async beginRating(nonce:string){this.ratingMatch=this.rated&&this.peerRating?(this.assignment?createRatingMatch(this.peerRating.id,nonce,this.assignment.pairId):createRatingMatch(this.peerRating.id,nonce)):Promise.resolve(null);return this.ratingMatch;}
  async report(score:0|.5|1,quit=false){if(!this.rated)return null;const id=await this.ratingMatch;return id?reportRating(id,score,quit):null;}

  /** The opponent's alias, title and level, validated. Safe defaults until their hello arrives (older clients send none). */
  peer: WireProfile = peerProfile(null);

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
    readonly rated = false,
    readonly assignment?:{opponent:string;nonce:string;pairId:string},
  ) {
    this.room = joinRoom({ appId: APP_ID, relayConfig: { urls: RELAY_URLS }, turnConfig: iceServers }, `${this.rated?'ranked-room':'room'}-${code}`);
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
      void (this.rated?loadRating():Promise.resolve(null)).then(me=>{if(this.closed)return;return this.ctl.send({ k:'hello',role:this.role,rated:this.rated,profile:localWireProfile(),...(me?{rating:{id:me.myId,points:me.rating}}:{})},{target:id});}).catch(()=>{});
    };
    this.room.onPeerLeave = (id: string) => {
      this.candidates.delete(id);
      if (id === this.peerId) {
        this.peerId = null;
        this.peerRating=null;
        this.onPeerLeft();
      }
    };
  }

  private handleCtl(m: CtlMessage, from: string): void {
    if(this.closed||!m||typeof m!=='object')return;
    if (m.k === 'hello') {
      if(m.role!=='host'&&m.role!=='guest')return;
      if((m.rated===true)!==this.rated)return;
      m={...m,rating:this.rated?peerRating(m.rating)??undefined:undefined};
      if(this.assignment&&m.rating?.id!==this.assignment.opponent)return;
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
        if(this.role==='host'){
          this.candidates.set(from,m);
          if(!this.pairingTimer)this.pairingTimer=setTimeout(()=>{
            this.pairingTimer=undefined;
            const mine=this.rated?currentRating()?.rating??1000:1000;
            const entries=[...this.candidates.entries()].sort((a,b)=>Math.abs((a[1].rating?.points??1000)-mine)-Math.abs((b[1].rating?.points??1000)-mine));
            const chosen=entries[0];this.candidates.clear();if(!chosen)return;
            this.pair(chosen[0],chosen[1]);
            for(const [id] of entries.slice(1))void this.ctl.send({k:'full'},{target:id});
          },150);
        }else this.candidates.set(from,m);
      }
      return;
    }
    if(m.k==='paired'&&this.assignment&&m.rating?.id!==this.assignment.opponent)return;
    if(m.k==='paired'&&this.role==='guest'&&!this.peerId&&this.candidates.has(from)&&(m.rated===true)===this.rated){this.candidates.clear();this.pair(from,{...m,k:'hello',role:'host'});return;}
    if (m.k === 'full') {
      if (!this.peerId) this.onRejected('full');
      return;
    }
    if (from === this.peerId) {
      // Bind rematch rating identity even while scenes are transitioning.
      if(this.rated&&m.k==='ratingSet'&&this.role==='guest'&&typeof m.nonce==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(m.nonce))void this.beginRating(m.nonce);
      this.onCtl(m);
    }
  }

  private pair(from:string,m:CtlMessage & {k:'hello'}){
    this.peerId=from;this.peer=peerProfile(m.profile);
    this.peerRating=this.rated?peerRating(m.rating):null;
    if(this.role==='host')void this.ctl.send({k:'paired',rated:this.rated,profile:localWireProfile(),...(this.rated&&currentRating()?{rating:{id:currentRating()!.myId,points:currentRating()!.rating}}:{})},{target:from});
    this.onPaired();
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
    await this.report(0,true);
    if(this.peerId)await this.ctl.send({k:'forfeit',round},{target:this.peerId}).catch(()=>{});
  }

  leave(): void {
    this.closed=true;
    if(this.pairingTimer)clearTimeout(this.pairingTimer);this.candidates.clear();
    void this.room.leave();
  }
}
