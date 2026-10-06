import { startScreen } from '../ui/presentation';
import Phaser from 'phaser';
import QRCode from 'qrcode';
import { applyCameraPixelRatio, PIXEL_RATIO, VIEW } from '../render/pixelRatio';
import { addVersionStamp } from '../version/versionStamp';
import { makeButton } from './FightStage';
import { NetSession, type Role } from '../net/session';
import { fetchTurnIceServers } from '../net/turn';
import { randomRoomCode, roomUrl } from '../net/roomCode';
import { tune, TICK_RATE } from '../sim/tune';
import { artImage, backdrop } from '../render/art';

// Host: create a room code, show it big with a QR code + link, wait for a
// guest, measure ping, pick the input delay, start the match.
// Guest: connect to the code (from ?room= or typed), wait for "start".

export interface MatchData {
  session: NetSession;
  localIdx: 0 | 1;
  delay: number;
  round: number;
  // Guest only: its own tune, restored after the match (it plays on the
  // host's values).
  restoreTune?: string;
  // Character ids [host, guest] (see sim/character.ts).
  chars: [string, string];
}

export class LobbyScene extends Phaser.Scene {
  private session: NetSession | null = null;
  private status!: Phaser.GameObjects.Text;
  private timeout?: Phaser.Time.TimerEvent;
  private handedOff = false;

  constructor() {
    super('Lobby');
  }

  create(data: { role: Role; code?: string }): void {
    applyCameraPixelRatio(this);
    backdrop(this);
    artImage(this, 'ui_panel', VIEW.cx, VIEW.cy, 470, 286, -1);
    this.handedOff = false;
    this.session = null;
    this.status = this.add
      .text(VIEW.cx, VIEW.bottom - 60, '', { fontFamily: 'monospace', fontSize: '13px', color: '#cccccc', align: 'center', resolution: PIXEL_RATIO })
      .setOrigin(0.5);
    makeButton(this, VIEW.left + 50, VIEW.top + 24, 70, 'BACK', () => this.back());
    this.events.once('shutdown', () => {
      this.timeout?.remove();
      if (!this.handedOff) this.session?.leave();
    });
    addVersionStamp(this);
    if (data.role === 'host') void this.host();
    else void this.join(data.code ?? '');
  }

  private back(message?: string): void {
    startScreen(this, 'Menu', { message });
  }

  private async host(): Promise<void> {
    const code = randomRoomCode();
    this.status.setText('Creating room...');
    const ice = await fetchTurnIceServers();
    if (!this.scene.isActive()) return;
    const s = new NetSession(code, 'host', ice);
    this.session = s;
    s.onRejected = () => {
      // Someone else is hosting this code: pick another.
      s.leave();
      this.scene.restart({ role: 'host' });
    };
    s.onPaired = () => void this.hostHandshake(s);
    s.onPeerLeft = () => this.status.setText('Opponent left. Waiting for opponent...');

    this.add
      .text(VIEW.cx - 110, VIEW.cy - 70, 'ROOM', { fontFamily: 'monospace', fontSize: '14px', color: '#aaaaaa', resolution: PIXEL_RATIO })
      .setOrigin(0.5);
    this.add
      .text(VIEW.cx - 110, VIEW.cy - 20, code, { fontFamily: 'monospace', fontSize: '64px', fontStyle: 'bold', color: '#ffffff', resolution: PIXEL_RATIO })
      .setOrigin(0.5);
    const url = roomUrl(code);
    this.add
      .text(VIEW.cx - 110, VIEW.cy + 30, 'Scan the QR code or\nenter the code in JOIN', { fontFamily: 'monospace', fontSize: '11px', color: '#aaaaaa', align: 'center', resolution: PIXEL_RATIO })
      .setOrigin(0.5);
    const dataUrl = await QRCode.toDataURL(url, { margin: 1, width: 170 * PIXEL_RATIO });
    if (!this.scene.isActive()) return;
    this.textures.once(Phaser.Textures.Events.ADD_KEY + 'qr-' + code, () => {
      this.add.image(VIEW.cx + 110, VIEW.cy - 20, 'qr-' + code).setDisplaySize(170, 170);
    });
    this.textures.addBase64('qr-' + code, dataUrl);
    this.status.setText('Waiting for opponent...');
  }

  private async hostHandshake(s: NetSession): Promise<void> {
    this.status.setText('Opponent found. Measuring ping...');
    const rtts: number[] = [];
    await new Promise<void>((resolve) => {
      let sent = 0;
      s.onCtl = (m) => {
        if (m.k === 'pong') {
          rtts.push(performance.now() - m.t);
          if (rtts.length >= tune.net.pingSamples) resolve();
        }
      };
      const tick = () => {
        if (rtts.length >= tune.net.pingSamples || !s.peerId) return;
        if (sent < tune.net.pingSamples * 3) {
          s.send({ k: 'ping', t: performance.now() });
          sent++;
          setTimeout(tick, 150);
        } else resolve();
      };
      tick();
    });
    if (!s.peerId || !this.scene.isActive()) return;
    rtts.sort((a, b) => a - b);
    const rtt = rtts.length ? rtts[Math.floor(rtts.length / 2)] : 200;
    const oneWayFrames = Math.ceil(rtt / 2 / (1000 / TICK_RATE));
    // Rollback covers up to maxRollbackFrames of lateness; only add input
    // delay beyond the base when the one-way ping exceeds that window.
    const delay = Math.max(tune.net.inputDelayFrames, oneWayFrames - tune.net.maxRollbackFrames + 1);
    // Both players now pick characters; the host starts from there.
    this.handedOff = true;
    startScreen(this, 'CharSelect', { mode: 'online', session: s, localIdx: 0, delay });
  }

  private async join(code: string): Promise<void> {
    this.add
      .text(VIEW.cx, VIEW.cy - 30, code, { fontFamily: 'monospace', fontSize: '64px', fontStyle: 'bold', color: '#ffffff', resolution: PIXEL_RATIO })
      .setOrigin(0.5);
    this.status.setText(`Joining room ${code}...`);
    const ice = await fetchTurnIceServers();
    if (!this.scene.isActive()) return;
    const s = new NetSession(code, 'guest', ice);
    this.session = s;
    s.onRejected = () => this.back(`Room ${code} is full`);
    s.onPaired = () => {
      this.handedOff = true;
      startScreen(this, 'CharSelect', { mode: 'online', session: s, localIdx: 1 });
    };
    s.onPeerLeft = () => this.back('Host left the room');
    s.onCtl = (m) => {
      if (m.k === 'ping') s.send({ k: 'pong', t: m.t });
    };
    this.timeout = this.time.delayedCall(tune.net.connectTimeoutMs, () => {
      if (!s.peerId) this.back(`No host found for room ${code}`);
    });
  }

}
