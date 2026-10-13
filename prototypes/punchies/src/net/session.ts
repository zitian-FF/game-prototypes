import {simulationRules,sameRules,tuneSnapshotHash,compatibleStart,type RulesStamp} from './rules';
import {validateTuneJson} from '../sim/tune';
import {currentRating,loadRating,createRatingMatch,reportRating,releaseRatingPair} from './rating';
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
  | { k: 'hello'; role: Role; rules?:RulesStamp; rated?:boolean; profile?: WireProfile; rating?:{id:string;points:number} }
  | { k: 'ratingSet';nonce:string }
  | { k:'paired';rules?:RulesStamp;rated?:boolean;profile?:WireProfile;rating?:{id:string;points:number} }
  | { k: 'full' }
  | {k:'incompatible'}
  | { k: 'ping'; t: number }
  | { k: 'pong'; t: number }
  | { k: 'start';rules?:RulesStamp;tuneHash?:string; rated?:boolean; round: number; delay: number; tune: string; chars: [string, string];skins?:[string,string];ratingNonce?:string }
  | { k: 'pick'; char: string | null;hover?:string;skin?:string;available?:string[] }
  | { k: 'rematch';rules?:RulesStamp; round: number }
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
  private rejectRules():void{this.compatiblePeer=false;this.gameStarted=false;this.pendingRating?.resolve(null);this.pendingRating=null;this.onRejected('incompatible');}
  private initialStartValidated=false;private startedRound=0;private playingRatingMatch:Promise<string|null>|null=null;
  private approvedStart=false;private localReadyRound:number|null=null;private remoteReadyRound:number|null=null;private currentRatingNonce:string|null=null;private validatedStartNonce:string|null=null;private ratingStarted=false;
  markRoundEnded():void{this.gameStarted=false;this.approvedStart=false;}
  private rematchReady(round:number,local:boolean):void{if(local)this.localReadyRound=round;else this.remoteReadyRound=round;this.validatedStartNonce=null;this.approvedStart=this.initialStartValidated&&round>this.startedRound&&this.localReadyRound===round&&this.remoteReadyRound===round;}
  private pendingRating:{nonce:string;resolve:(id:string|null)=>void}|null=null;
  private commitStart():boolean{
    if(!this.readyForMatch||!this.approvedStart)return false;
    const pending=this.pendingRating;
    if(pending&&this.validatedStartNonce&&pending.nonce!==this.validatedStartNonce){this.rejectRules();return false;}
    this.gameStarted=true;if(this.localReadyRound!==null)this.startedRound=this.localReadyRound;this.localReadyRound=null;this.remoteReadyRound=null;
    if(pending){this.pendingRating=null;this.currentRatingNonce=pending.nonce;this.ratingStarted=true;this.playingRatingMatch=this.ratingMatch;void this.createRating(pending.nonce).then(pending.resolve,()=>pending.resolve(null));}
    return true;
  }
  private createRating(nonce:string):Promise<string|null>{return this.rated&&this.peerRating?(this.assignment?createRatingMatch(this.peerRating.id,nonce,this.assignment.pairId):createRatingMatch(this.peerRating.id,nonce)):Promise.resolve(null);}
  private compatiblePeer=false;private gameStarted=false;
  get readyForMatch():boolean{return !this.closed&&!!this.peerId&&this.compatiblePeer;}
  markMatchStarted():boolean {if(!this.readyForMatch)return false;return this.gameStarted||this.commitStart();}
  private closed=false;private initialQueueNonceUsed=false;
  nextRatingNonce():string {if(this.assignment&&!this.initialQueueNonceUsed){this.initialQueueNonceUsed=true;return this.assignment.nonce;}return crypto.randomUUID();}
  async beginRating(nonce:string){
    if(!this.rated||!this.readyForMatch)return null;
    if(this.currentRatingNonce===nonce&&this.ratingStarted)return this.ratingMatch;
    if(this.gameStarted&&this.validatedStartNonce===nonce){this.currentRatingNonce=nonce;this.ratingStarted=true;this.ratingMatch=this.createRating(nonce);this.playingRatingMatch=this.ratingMatch;return this.ratingMatch;}
    if(this.pendingRating?.nonce===nonce)return this.ratingMatch;
    this.ratingStarted=false;this.pendingRating?.resolve(null);
    this.ratingMatch=new Promise(resolve=>{this.pendingRating={nonce,resolve};});return this.ratingMatch;
  }
  async report(score:0|.5|1,quit=false){if(!this.rated||(!this.gameStarted&&!this.ratingStarted))return null;const id=await(this.playingRatingMatch??this.ratingMatch);return id?reportRating(id,score,quit):null;}

  /** The opponent's alias, title and level, validated. Safe defaults until their hello arrives (older clients send none). */
  peer: WireProfile = peerProfile(null);

  onPaired: () => void = () => {};
  onPeerLeft: () => void = () => {};
  onCtl: (m: CtlMessage) => void = () => {};
  onInputs: (p: InputPacket) => void = () => {};
  onHash: (p: HashPacket) => void = () => {};
  onRejected: (reason: 'full' | 'collision'|'incompatible') => void = () => {};

  constructor(
    readonly code: string,
    readonly role: Role,
    iceServers: RTCIceServer[] | undefined,
    readonly rated = false,
    readonly assignment?:{opponent:string;nonce:string;pairId:string;baseline?:{local:number;opponent:number}|null},
  ) {
    this.room = joinRoom({ appId: APP_ID, relayConfig: { urls: RELAY_URLS }, turnConfig: iceServers }, `${this.rated?'ranked-room':'room'}-${code}`);
    this.ctl = this.room.makeAction('ctl') as unknown as Channel<CtlMessage>;
    this.inp = this.room.makeAction('inp') as unknown as Channel<InputPacket>;
    this.hsh = this.room.makeAction('hsh') as unknown as Channel<HashPacket>;

    this.ctl.onMessage = (m, c) => this.handleCtl(m, c.peerId);
    this.inp.onMessage = (p, c) => {
      if (c.peerId === this.peerId&&this.readyForMatch&&this.gameStarted) this.onInputs(p);
    };
    this.hsh.onMessage = (p, c) => {
      if (c.peerId === this.peerId&&this.readyForMatch&&this.gameStarted) this.onHash(p);
    };

    this.room.onPeerJoin = (id: string) => {
      void (this.rated?loadRating():Promise.resolve(null)).then(me=>{if(this.closed)return;return this.ctl.send({ k:'hello',role:this.role,rules:simulationRules(),rated:this.rated,profile:localWireProfile(),...(me?{rating:{id:me.myId,points:me.rating}}:{})},{target:id});}).catch(()=>{});
    };
    this.room.onPeerLeave = (id: string) => {
      this.candidates.delete(id);
      if (id === this.peerId) {
        this.peerId = null;this.compatiblePeer=false;this.gameStarted=false;
        this.peerRating=null;
        this.onPeerLeft();
      }
    };
  }

  private handleCtl(m: CtlMessage, from: string): void {
    if(this.closed||!m||typeof m!=='object')return;
    if(m.k==='incompatible'){if(from===this.peerId||this.candidates.has(from)||!this.peerId){this.compatiblePeer=false;this.gameStarted=false;this.rejectRules();}return;}
    if (m.k === 'hello') {
      if(m.role!=='host'&&m.role!=='guest')return;
      if((m.rated===true)!==this.rated)return;
      m={...m,rating:this.rated?peerRating(m.rating)??undefined:undefined};
      if(this.assignment&&m.rating?.id!==this.assignment.opponent)return;
      if(!sameRules(m.rules)){this.candidates.delete(from);void this.ctl.send({k:'incompatible'},{target:from});if(!this.peerId)this.rejectRules();return;}
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
    if(m.k==='paired'&&this.peerId&&from!==this.peerId)return;
    if(m.k==='paired'&&!sameRules(m.rules)){this.candidates.delete(from);this.rejectRules();return;}
    if(m.k==='paired'&&this.assignment&&m.rating?.id!==this.assignment.opponent)return;
    if(m.k==='paired'&&this.role==='guest'&&!this.peerId&&this.candidates.has(from)&&(m.rated===true)===this.rated){this.candidates.clear();this.pair(from,{...m,k:'hello',role:'host'});return;}
    if (m.k === 'full') {
      if (!this.peerId) this.onRejected('full');
      return;
    }
    if (from === this.peerId&&this.readyForMatch) {
      if(m.k==='ratingSet'){this.approvedStart=false;this.localReadyRound=null;this.remoteReadyRound=null;}
      if(m.k==='rematch'){if(!sameRules(m.rules)||!Number.isSafeInteger(m.round)||m.round<1){this.rejectRules();return;}this.rematchReady(m.round,false);}
      if(m.k==='start'){
        if(this.role!=='guest')return;
        if(this.startedRound>0&&m.round<=this.startedRound&&this.gameStarted)return;
        if(!compatibleStart(m,this.rated,validateTuneJson)){this.gameStarted=false;this.rejectRules();return;}
        this.initialStartValidated=true;this.startedRound=m.round;this.approvedStart=true;this.validatedStartNonce=m.ratingNonce??null;this.commitStart();
      }
      // Bind rematch rating identity even while scenes are transitioning.
      if(this.rated&&m.k==='ratingSet'&&this.role==='guest'&&typeof m.nonce==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(m.nonce))void this.beginRating(m.nonce);
      this.onCtl(m);
    }
  }

  private pair(from:string,m:CtlMessage & {k:'hello'}){
    if(!sameRules(m.rules)){this.rejectRules();return;}
    this.compatiblePeer=true;this.peerId=from;this.peer=peerProfile(m.profile);
    this.peerRating=this.rated?peerRating(m.rating):null;
    if(this.role==='host')void this.ctl.send({k:'paired',rules:simulationRules(),rated:this.rated,profile:localWireProfile(),...(this.rated&&currentRating()?{rating:{id:currentRating()!.myId,points:currentRating()!.rating}}:{})},{target:from});
    this.onPaired();
  }
  send(m: CtlMessage): void {
    if(!this.readyForMatch)return;
    if(m.k==='start'){m={...m,rules:simulationRules(),tuneHash:tuneSnapshotHash(m.tune)!};if(!compatibleStart(m,this.rated,validateTuneJson)){this.rejectRules();return;}this.approvedStart=true;this.validatedStartNonce=m.ratingNonce??null;this.commitStart();}
    if(m.k==='ratingSet'){this.approvedStart=false;this.localReadyRound=null;this.remoteReadyRound=null;}
    if(m.k==='rematch'){m={...m,rules:simulationRules()};this.rematchReady(m.round,true);}
    if (this.peerId) void this.ctl.send(m, { target: this.peerId });
  }

  sendInputs(p: InputPacket): void {
    if (this.readyForMatch&&this.gameStarted&&this.peerId) void this.inp.send(p, { target: this.peerId });
  }

  sendHash(p: HashPacket): void {
    if (this.readyForMatch&&this.gameStarted&&this.peerId) void this.hsh.send(p, { target: this.peerId });
  }

  async forfeit(round:number): Promise<void> {
    if(!this.readyForMatch||(!this.gameStarted&&!this.ratingStarted))return;
    await this.report(0,true);
    if(this.peerId)await this.ctl.send({k:'forfeit',round},{target:this.peerId}).catch(()=>{});
  }

  leave(): void {
    this.closed=true;this.pendingRating?.resolve(null);this.pendingRating=null;
    if(!this.gameStarted&&this.assignment)void releaseRatingPair(this.assignment.pairId).catch(()=>{});
    if(this.pairingTimer)clearTimeout(this.pairingTimer);this.candidates.clear();
    void this.room.leave();
  }
}
