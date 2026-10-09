import { startScreen } from '../ui/presentation';
import { t } from '../i18n';
import { track } from '../portal/analytics';
import Phaser from 'phaser';
import { isDebug } from '../debug/debugPanel';
import { cartoonPanel } from '../ui/cartoonChrome';
import QRCode from 'qrcode';
import { applyCameraPixelRatio, PIXEL_RATIO, VIEW } from '../render/pixelRatio';
import { addVersionStamp } from '../version/versionStamp';
import { makeButton } from './FightStage';
import { NetSession, relayStatus, type Role } from '../net/session';
import { fetchTurnIceServers } from '../net/turn';
import { randomRoomCode, roomUrl } from '../net/roomCode';
import { tune, TICK_RATE } from '../sim/tune';
import { backdrop } from '../render/art';

// Host: create a room code, show it big with a QR code + link, wait for a
// guest, measure ping, pick the input delay, start the match.
// Guest: connect to the code (from ?room= or typed), wait for "start".

export interface MatchData {
  session: NetSession;
  localIdx: 0 | 1;
  delay: number;
  round: number;
  series?: import('../sim/series').SeriesState;
  // Guest only: its own tune, restored after the match (it plays on the
  // host's values).
  restoreTune?: string;
  // Character ids [host, guest] (see sim/character.ts).
  chars: [string, string];
  skins?:[string,string];
}

export class LobbyScene extends Phaser.Scene {
  private session: NetSession | null = null;
  private status!: Phaser.GameObjects.Text;
  private timeout?: Phaser.Time.TimerEvent;
  private handedOff = false;
  private diag!: Phaser.GameObjects.Text;
  private turnServers = 0;
  private startedAt = 0;

  constructor() {
    super('Lobby');
  }

  create(data: { role: Role; code?: string }): void {
    applyCameraPixelRatio(this);
    backdrop(this);
    cartoonPanel(this.add.graphics().setDepth(-1),VIEW.cx-235,VIEW.cy-143,470,286,0x28517d,15);
    this.handedOff = false;
    this.session = null;
    this.status = this.add
      .text(VIEW.cx, VIEW.bottom - 60, '', { fontFamily: 'Arial', fontSize: '17px', color: '#fff1d1', align: 'center', resolution: PIXEL_RATIO })
      .setOrigin(0.5);
    // Small connection line (relays reached, TURN fetched, seconds waited): tells us why a lobby is stuck, e.g. on a phone.
    this.startedAt = this.time.now;
    this.turnServers = 0;
    this.diag = this.add
      .text(VIEW.cx, VIEW.bottom - 36, '', { fontFamily: 'Arial', fontSize: '10px', color: '#7f8fa5', resolution: PIXEL_RATIO })
      .setOrigin(0.5).setVisible(isDebug());
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.updateDiag() });
    makeButton(this, VIEW.left + 50, VIEW.top + 24, 70, t('common.back'), () => this.back());
    this.events.once('shutdown', () => {
      this.timeout?.remove();
      if (!this.handedOff) this.session?.leave();
    });
    addVersionStamp(this);
    if (data.role === 'host') void this.host();
    else void this.join(data.code ?? '');
  }

  private diagProps(): { relays_open: number; relays_total: number; turn: number; secs: number } {
    const r = relayStatus();
    return { relays_open: r.open, relays_total: r.total, turn: this.turnServers, secs: Math.floor((this.time.now - this.startedAt) / 1000) };
  }

  private updateDiag(): void {
    const d = this.diagProps();
    this.diag.setVisible(isDebug()).setText(`relays ${d.relays_open}/${d.relays_total} · TURN ${d.turn ? 'yes' : 'no'} · ${d.secs}s`);
    // One record for the debug log when a lobby has been waiting a while with no relay open.
    if (d.secs === 15 && d.relays_open === 0) track('online', 'lobby', 'no_relays', d);
  }

  private back(message?: string): void {
    startScreen(this, 'Menu', { message });
  }

  private async host(): Promise<void> {
    const code = randomRoomCode();
    this.status.setText(t('lobby.creating_room'));
    const ice = await fetchTurnIceServers();
    this.turnServers = ice?.length ?? 0;
    if (!this.scene.isActive()) return;
    const s = new NetSession(code, 'host', ice);
    this.session = s;
    s.onRejected = () => {
      // Someone else is hosting this code: pick another.
      s.leave();
      this.scene.restart({ role: 'host' });
    };
    s.onPaired = () => {
      track('online', 'host', 'connected');
      void this.hostHandshake(s);
    };
    s.onPeerLeft = () => this.status.setText(t('lobby.opponent_left_waiting_for_opponent'));

    this.add
      .text(VIEW.cx - 110, VIEW.cy - 70, t('lobby.room'), { fontFamily: 'Arial', fontSize: '18px', fontStyle:'bold', color: '#dbe9fa', resolution: PIXEL_RATIO })
      .setOrigin(0.5);
    this.add
      .text(VIEW.cx - 110, VIEW.cy - 20, code, { fontFamily: 'Arial', fontSize: '64px', fontStyle: 'bold', color: '#ffffff', resolution: PIXEL_RATIO })
      .setOrigin(0.5);
    const url = roomUrl(code);
    this.add
      .text(VIEW.cx - 110, VIEW.cy + 30, t('lobby.scan_the_qr_code_or'), { fontFamily: 'Arial', fontSize: '15px', color: '#dbe9fa', align: 'center', resolution: PIXEL_RATIO })
      .setOrigin(0.5);
    const dataUrl = await QRCode.toDataURL(url, { margin: 1, width: 170 * PIXEL_RATIO });
    if (!this.scene.isActive()) return;
    this.textures.once(Phaser.Textures.Events.ADD_KEY + 'qr-' + code, () => {
      this.add.image(VIEW.cx + 110, VIEW.cy - 20, 'qr-' + code).setDisplaySize(170, 170);
    });
    this.textures.addBase64('qr-' + code, dataUrl);
    this.status.setText(t('lobby.waiting_for_opponent'));
  }

  private async hostHandshake(s: NetSession): Promise<void> {
    this.status.setText(t('lobby.opponent_found_measuring_ping'));
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
      .text(VIEW.cx, VIEW.cy - 30, code, { fontFamily: 'Arial', fontSize: '64px', fontStyle: 'bold', color: '#ffffff', resolution: PIXEL_RATIO })
      .setOrigin(0.5);
    this.status.setText(t('lobby.joining_room', { code }));
    const ice = await fetchTurnIceServers();
    this.turnServers = ice?.length ?? 0;
    if (!this.scene.isActive()) return;
    const s = new NetSession(code, 'guest', ice);
    this.session = s;
    s.onRejected = () => {
      track('online', 'guest', 'failed', { reason: 'room_full' });
      this.back(t('lobby.room_full', { code }));
    };
    s.onPaired = () => {
      track('online', 'guest', 'connected');
      this.handedOff = true;
      startScreen(this, 'CharSelect', { mode: 'online', session: s, localIdx: 1 });
    };
    s.onPeerLeft = () => this.back(t('lobby.host_left_the_room'));
    s.onCtl = (m) => {
      if (m.k === 'ping') s.send({ k: 'pong', t: m.t });
    };
    this.timeout = this.time.delayedCall(tune.net.connectTimeoutMs, () => {
      if (!s.peerId) {
        track('online', 'guest', 'failed', { reason: 'no_host', ...this.diagProps() });
        this.back(t('lobby.no_host', { code }));
      }
    });
  }

}
