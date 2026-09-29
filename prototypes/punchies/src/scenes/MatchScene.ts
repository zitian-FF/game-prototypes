import Phaser from 'phaser';
import { applyCameraPixelRatio, PIXEL_RATIO, VIEW } from '../render/pixelRatio';
import { addVersionStamp } from '../version/versionStamp';
import { FightStage, makeButton } from './FightStage';
import { Lockstep } from '../net/lockstep';
import type { MatchData } from './LobbyScene';
import { restoreTune, tune, TICK_RATE } from '../sim/tune';

// Online 1v1 over lockstep. Host is fighter 0 (left), guest fighter 1.
// The sim only advances when both players' inputs for the next tick have
// arrived; while it can't, a small "waiting for opponent" indicator shows so
// a stall doesn't read as a freeze/bug.

const STEP_MS = 1000 / TICK_RATE;
const MAX_STEPS_PER_FRAME = 5;

export class MatchScene extends Phaser.Scene {
  private match!: MatchData;
  private ls!: Lockstep;
  private stage!: FightStage;
  private acc = 0;
  private stalledSince = 0;
  private waiting!: Phaser.GameObjects.Text;
  private info!: Phaser.GameObjects.Text;
  private endButtons: Phaser.GameObjects.GameObject[] = [];
  private rematchLocal = false;
  private rematchRemote = false;
  private over = false;

  constructor() {
    super('Match');
  }

  create(data: MatchData): void {
    applyCameraPixelRatio(this);
    this.match = data;
    this.acc = 0;
    this.stalledSince = 0;
    this.over = false;
    this.rematchLocal = false;
    this.rematchRemote = false;
    this.endButtons = [];

    const s = data.session;
    this.ls = new Lockstep(
      data.localIdx,
      data.delay,
      data.round,
      (p) => s.sendInputs(p),
      (p) => s.sendHash(p),
    );
    s.onInputs = (p) => this.ls.receiveInputs(p);
    s.onHash = (p) => this.ls.receiveHash(p);
    s.onCtl = (m) => {
      if (m.k === 'ping') s.send({ k: 'pong', t: m.t });
      if (m.k === 'rematch' && m.round === data.round + 1) {
        this.rematchRemote = true;
        this.tryRematch();
      }
    };
    s.onPeerLeft = () => this.opponentLeft();

    const names: [string, string] = data.localIdx === 0 ? ['YOU (host)', 'OPPONENT'] : ['OPPONENT', 'YOU'];
    this.stage = new FightStage(this, names, data.localIdx);
    makeButton(this, VIEW.cx + 70, VIEW.top + 46, 56, 'LEAVE', () => this.leave());

    this.waiting = this.add
      .text(VIEW.cx, tune.ring.top + 16, 'waiting for opponent...', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#ffd24a',
        backgroundColor: '#000000aa',
        padding: { x: 6, y: 3 },
        resolution: PIXEL_RATIO,
      })
      .setOrigin(0.5)
      .setDepth(140)
      .setVisible(false);
    this.info = this.add
      .text(VIEW.cx - 40, VIEW.top + 46, `room ${s.code}  delay ${data.delay}f`, {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: '#888888',
        resolution: PIXEL_RATIO,
      })
      .setOrigin(0.5)
      .setDepth(140);
    addVersionStamp(this);
  }

  update(time: number, delta: number): void {
    this.stage.pollDevices();
    if (!this.over) {
      this.acc = Math.min(this.acc + delta, STEP_MS * MAX_STEPS_PER_FRAME);
      let stalled = false;
      while (this.acc >= STEP_MS) {
        if (this.ls.canScheduleLocal()) this.ls.scheduleLocal(this.stage.intents.sample());
        if (!this.ls.canStep()) {
          stalled = true;
          this.ls.flushInputs();
          break;
        }
        this.acc -= STEP_MS;
        const events = this.ls.step();
        this.stage.handleEvents(events, this.ls.sim);
      }
      if (stalled) {
        // Don't bank time while stalled, or the sim would fast-forward in a
        // burst once inputs arrive.
        this.acc = Math.min(this.acc, STEP_MS);
        if (!this.stalledSince) this.stalledSince = time;
      } else {
        this.stalledSince = 0;
      }
      this.waiting.setVisible(this.stalledSince > 0 && time - this.stalledSince > tune.net.stallIndicatorMs);
      if (this.ls.desynced) this.info.setText('DESYNC detected').setColor('#ff5a5a');
      if (this.ls.sim.result) this.showResult();
    }
    this.stage.draw(this.ls.sim, time);
  }

  private showResult(): void {
    this.over = true;
    this.waiting.setVisible(false);
    const r = this.ls.sim.result!;
    const text = r.winner === null ? 'DRAW' : r.winner === this.match.localIdx ? 'YOU WIN' : 'YOU LOSE';
    const sub = r.reason === 'ko' ? 'by K.O.' : 'on points (health)';
    this.endButtons.push(
      this.add
        .text(VIEW.cx, VIEW.cy + 40, `${text}\n${sub}`, {
          fontFamily: 'monospace',
          fontSize: '22px',
          fontStyle: 'bold',
          color: '#ffffff',
          align: 'center',
          stroke: '#000000',
          strokeThickness: 5,
          resolution: PIXEL_RATIO,
        })
        .setOrigin(0.5)
        .setDepth(150),
    );
    const rem = makeButton(this, VIEW.cx - 60, VIEW.cy + 100, 100, 'REMATCH', () => {
      if (this.rematchLocal) return;
      this.rematchLocal = true;
      rem.setText('WAITING...');
      this.match.session.send({ k: 'rematch', round: this.match.round + 1 });
      this.tryRematch();
    });
    makeButton(this, VIEW.cx + 60, VIEW.cy + 100, 100, 'MENU', () => this.leave());
  }

  private tryRematch(): void {
    if (!this.rematchLocal || !this.rematchRemote) return;
    this.scene.restart({ ...this.match, round: this.match.round + 1 });
  }

  private opponentLeft(): void {
    this.over = true;
    this.waiting.setVisible(false);
    this.add
      .text(VIEW.cx, VIEW.cy, 'Opponent disconnected', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#ffffff',
        backgroundColor: '#000000cc',
        padding: { x: 10, y: 6 },
        resolution: PIXEL_RATIO,
      })
      .setOrigin(0.5)
      .setDepth(150);
    makeButton(this, VIEW.cx, VIEW.cy + 50, 100, 'MENU', () => this.leave());
  }

  private leave(): void {
    this.match.session.leave();
    if (this.match.restoreTune) restoreTune(this.match.restoreTune);
    this.scene.start('Menu');
  }
}
