import { startScreen } from '../ui/presentation';
import Phaser from 'phaser';
import { applyCameraPixelRatio, PIXEL_RATIO, VIEW } from '../render/pixelRatio';
import { addVersionStamp } from '../version/versionStamp';
import { FightStage, makeButton } from './FightStage';
import { getNav } from '../ui/menuNav';
import { fighterGroups, prefetchGroups } from '../render/art';
import { Rollback } from '../net/rollback';
import type { MatchData } from './LobbyScene';
import { charName } from '../sim/character';
import { restoreTune, tune, TICK_RATE } from '../sim/tune';
import { isDebug } from '../debug/debugPanel';
import type { SimState } from '../sim/types';
import { newSeries, finishRound, type SeriesState } from '../sim/series';
import { roundSplash, matchResult } from '../ui/matchPresentation';

// Online 1v1 over rollback netcode (see net/rollback.ts). Host is fighter 0 (left), guest fighter 1.
// The sim only advances when both players' inputs for the next tick have
// arrived; while it can't, a small "waiting for opponent" indicator shows so
// a stall doesn't read as a freeze/bug.

const STEP_MS = 1000 / TICK_RATE;
const MAX_STEPS_PER_FRAME = 5;

export class MatchScene extends Phaser.Scene {
  private match!: MatchData;
  private ls!: Rollback;
  private stage!: FightStage;
  private acc = 0;
  private stalledSince = 0;
  private waiting!: Phaser.GameObjects.Text;
  private info!: Phaser.GameObjects.Text;
  private rematchLocal = false;
  private rematchRemote = false;
  private over = false;
  private departed = false;
  private series!: SeriesState;
  private advancing = false;
  private nextSeries: SeriesState | undefined;
  private remoteReselect = false;
  private cancelSplash: (() => void) | undefined;
  // Enhanced netcode (tune.net.enhanced, host authoritative): split input
  // delay, eased corrections and an adaptive punch delay. Off = unchanged.
  private enhanced = false;
  private baseDelay = 0;
  private rtt = 0;
  private nextPing = 0;
  private nextAdapt = 0;
  private lastRollbacks = 0;
  private shown: { x: number; y: number }[] = [];
  private off: { x: number; y: number }[] = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
  // Debug readout (only drawn while debug mode is on).
  private stats!: Phaser.GameObjects.Text;
  private statsAt = 0;
  private statsPrev = { t: 0, rb: 0, fr: 0 };
  private statsRate = { rb: 0, fr: 0 };
  private stallCount = 0;

  constructor() {
    super('Match');
  }

  create(data: MatchData): void {
    applyCameraPixelRatio(this);
    this.match = data;
    this.series = data.series ?? newSeries(tune.match.bestOf);
    this.nextSeries = undefined;
    this.remoteReselect = false;
    this.cancelSplash = undefined;
    this.advancing = false;
    this.acc = 0;
    this.stalledSince = 0;
    this.over = false;
    this.departed = false;
    this.rematchLocal = false;
    this.rematchRemote = false;
    this.enhanced = tune.net.enhanced >= 0.5;
    this.rtt = 0;
    this.nextPing = 0;
    this.nextAdapt = 0;
    this.lastRollbacks = 0;
    this.shown = [];
    this.off = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
    this.statsAt = 0;
    this.statsPrev = { t: 0, rb: 0, fr: 0 };
    this.statsRate = { rb: 0, fr: 0 };
    this.stallCount = 0;

    const s = data.session;
    // Enhanced: stick and guard use the short delay, taps keep the full one.
    this.baseDelay = this.enhanced ? Math.max(0, Math.min(data.delay, Math.round(tune.net.moveDelayFrames))) : data.delay;
    this.ls = new Rollback(
      data.localIdx,
      this.baseDelay,
      tune.net.maxRollbackFrames,
      data.round,
      (p) => s.sendInputs(p),
      (p) => s.sendHash(p),
      data.chars,
      { tapExtra: this.enhanced ? data.delay - this.baseDelay : 0, showcase: this.series.roundNumber === 1 },
    );
    s.onInputs = (p) => this.ls.receiveInputs(p);
    s.onHash = (p) => this.ls.receiveHash(p);
    s.onCtl = (m) => {
      if(m.k==='forfeit' && m.round===data.round){this.opponentLeft(true);return;}
      if (m.k === 'ping') s.send({ k: 'pong', t: m.t });
      if (m.k === 'pong') this.rtt = this.rtt > 0 ? this.rtt * 0.8 + (performance.now() - m.t) * 0.2 : performance.now() - m.t;
      if (m.k === 'reselect' && m.round === data.round) { this.remoteReselect = true; this.changeBoxer(); }
      if (m.k === 'rematch' && m.round === data.round + 1) {
        this.rematchRemote = true;
        this.tryRematch();
      }
    };
    s.onPeerLeft = () => this.opponentLeft();

    const nm = (i: 0 | 1) => charName(data.chars[i]);
    const names: [string, string] =
      data.localIdx === 0 ? [`YOU (host) · ${nm(0)}`, `OPPONENT · ${nm(1)}`] : [`OPPONENT · ${nm(0)}`, `YOU · ${nm(1)}`];
    // No waiting here: the session is live, so a late atlas just pops in.
    prefetchGroups(fighterGroups(data.chars));
    this.stage = new FightStage(this, names, data.localIdx,true,data.skins);
    this.stage.setSeries(this.series);

    this.events.on('menuReturn',()=>this.leave());
    this.events.once('shutdown',()=>this.events.removeAllListeners('menuReturn'));

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
      .text(VIEW.cx - 40, VIEW.top + 46, this.enhanced
        ? `room ${s.code}  stick ${this.baseDelay}f punch ${data.delay}f · rollback+`
        : `room ${s.code}  delay ${data.delay}f · rollback`, {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: '#888888',
        resolution: PIXEL_RATIO,
      })
      .setOrigin(0.5)
      .setDepth(140);
    this.stats = this.add
      .text(VIEW.left + 8, VIEW.top + 112, '', { fontFamily: 'monospace', fontSize: '9px', color: '#ff9a9a', backgroundColor: '#000000aa', padding: { x: 4, y: 2 }, resolution: PIXEL_RATIO })
      .setDepth(140)
      .setVisible(false);
    addVersionStamp(this);
  }

  update(time: number, delta: number): void {
    this.stage.pollDevices();
    if (!this.over) {
      // Late remote inputs that contradict a prediction are corrected here,
      // even while stalled.
      this.stage.handleEvents(this.ls.resolve(), this.ls.sim);
      this.acc = Math.min(this.acc + delta, STEP_MS * MAX_STEPS_PER_FRAME);
      let stalled = false;
      while (this.acc >= STEP_MS) {
        if (this.ls.canScheduleLocal()) this.ls.scheduleLocal(this.stage.sampleLocal());
        if (!this.ls.canStep()) {
          stalled = true;
          this.ls.flushInputs();
          break;
        }
        this.acc -= STEP_MS;
        if (this.ls.shouldWaitForSync()) continue;
        const events = this.ls.step();
        this.stage.handleEvents(events, this.ls.sim);
      }
      if (stalled) {
        // Don't bank time while stalled, or the sim would fast-forward in a
        // burst once inputs arrive.
        this.acc = Math.min(this.acc, STEP_MS);
        if (!this.stalledSince) {
          this.stalledSince = time;
          this.stallCount++;
        }
      } else {
        this.stalledSince = 0;
      }
      this.waiting.setVisible(this.stalledSince > 0 && time - this.stalledSince > tune.net.stallIndicatorMs);
      if (this.ls.desynced) this.info.setText('DESYNC detected').setColor('#ff5a5a');
      if (this.ls.confirmedResult() && this.stage.koFinished(this.ls.sim, time)) this.showResult();
    }
    if (!this.over && (this.enhanced || isDebug())) this.adapt(time);
    this.updateStats(time);
    this.stage.draw(this.displayState(), time, !!this.ls.confirmedResult());
  }

  // Re-measure the ping during the match (also in standard mode while debug is
  // on, for the readout). Enhanced only: move the punch delay one frame at a
  // time toward adaptFactor times the one-way ping. Each peer picks its own,
  // since inputs are stamped with ticks (see rollback.ts).
  private adapt(time: number): void {
    const s = this.match.session;
    if (time >= this.nextPing) {
      this.nextPing = time + 1000;
      s.send({ k: 'ping', t: performance.now() });
    }
    if (!this.enhanced || this.rtt <= 0 || time < this.nextAdapt) return;
    this.nextAdapt = time + 1500;
    const oneWayFrames = this.rtt / 2 / STEP_MS;
    const floor = Math.max(this.baseDelay, tune.net.inputDelayFrames);
    const total = Math.round(Math.min(Math.max(tune.net.adaptMaxFrames, floor), Math.max(floor, oneWayFrames * tune.net.adaptFactor)));
    const want = total - this.baseDelay;
    const cur = this.ls.tapDelay;
    if (want !== cur) this.ls.setTapExtra(cur + Math.sign(want - cur));
  }

  // Enhanced: after a rollback that moved a boxer by more than a few px, draw
  // them where they were and ease to the exact sim position over smoothFrames.
  // Picture only: the sim, hit effects and hitboxes stay exact.
  private displayState(): SimState {
    const sim = this.ls.sim;
    const n = this.enhanced ? Math.round(tune.net.smoothFrames) : 0;
    if (n <= 0) return sim;
    const rolled = this.ls.rollbacks !== this.lastRollbacks;
    this.lastRollbacks = this.ls.rollbacks;
    const fighters = sim.fighters.map((f, i) => {
      const prev = this.shown[i];
      const off = this.off[i];
      if (rolled && prev) {
        const dx = prev.x - f.x;
        const dy = prev.y - f.y;
        const mag = Math.hypot(dx, dy);
        if (mag > 3 && mag < 80) {
          off.x = dx;
          off.y = dy;
        }
      }
      const decay = 1 - 1 / n;
      off.x *= decay;
      off.y *= decay;
      if (Math.abs(off.x) < 0.2) off.x = 0;
      if (Math.abs(off.y) < 0.2) off.y = 0;
      const x = f.x + off.x;
      const y = f.y + off.y;
      this.shown[i] = { x, y };
      return off.x === 0 && off.y === 0 ? f : { ...f, x, y };
    }) as SimState['fighters'];
    return { ...sim, fighters };
  }

  private updateStats(time: number): void {
    const on = isDebug();
    this.stats.setVisible(on);
    if (!on || time < this.statsAt) return;
    this.statsAt = time + 250;
    const ls = this.ls;
    if (time - this.statsPrev.t >= 1000) {
      const dt = (time - this.statsPrev.t) / 1000;
      if (this.statsPrev.t > 0) this.statsRate = { rb: (ls.rollbacks - this.statsPrev.rb) / dt, fr: (ls.rolledBackFrames - this.statsPrev.fr) / dt };
      this.statsPrev = { t: time, rb: ls.rollbacks, fr: ls.rolledBackFrames };
    }
    const avg = ls.rollbacks > 0 ? ls.rolledBackFrames / ls.rollbacks : 0;
    const ping = this.rtt > 0 ? `${Math.round(this.rtt)}ms` : '...';
    this.stats.setText(
      `net ${this.enhanced ? 'ENHANCED' : 'standard'}\n` +
        `rollbacks ${this.statsRate.rb.toFixed(1)}/s  frames ${this.statsRate.fr.toFixed(1)}/s\n` +
        `depth avg ${avg.toFixed(1)} max ${ls.maxRollbackDepth}  stalls ${this.stallCount}\n` +
        `rtt ${ping}  stick ${this.baseDelay}f punch ${this.baseDelay + ls.tapDelay}f`,
    );
  }

  private showResult(): void {
    this.over = true;
    this.waiting.setVisible(false);
    const r = this.ls.confirmedResult()!;
    const outcome = finishRound(this.series, r.winner);
    this.stage.setSeries(outcome.series);
    if (!outcome.complete) {
      this.nextSeries = outcome.series;
      this.rematchLocal = true;
      const ready = () => this.match.session.send({ k: 'rematch', round: this.match.round + 1 });
      ready();
      this.time.addEvent({ delay: 500, loop: true, callback: ready });
      this.tryRematch();
      return;
    }
    const text = r.winner === null ? 'DRAW' : r.winner === this.match.localIdx ? 'VICTORY' : 'DEFEAT';
    if (this.remoteReselect) { this.changeBoxer(); return; }
    const rem = matchResult(this, text, {
      rematch: () => {
        if (this.rematchLocal) return;
        this.rematchLocal = true;
        rem.setText('WAITING...');
        this.match.session.send({ k: 'rematch', round: this.match.round + 1 });
        this.tryRematch();
      },
      changeBoxer: () => {
        this.match.session.send({ k: 'reselect', round: this.match.round });
        this.changeBoxer();
      },
      menu: () => this.leave(),
    }, outcome.series.wins);
  }

  private tryRematch(): void {
    if (!this.over || !this.rematchLocal || !this.rematchRemote || this.advancing) return;
    this.advancing = true;
    this.cancelSplash = roundSplash(this, () => this.scene.restart({ ...this.match, round: this.match.round + 1, series: this.nextSeries }));
  }

  private changeBoxer(): void {
    if (this.advancing || !this.over || this.nextSeries) return;
    this.advancing = true;
    startScreen(this, 'CharSelect', { mode: 'online', session: this.match.session,
      localIdx: this.match.localIdx, delay: this.match.delay, restoreTune: this.match.restoreTune,
      nextRound: this.match.round + 1 });
  }

  private opponentLeft(forfeited=false): void {
    if(this.departed)return;
    this.departed=true;this.rematchLocal=false;this.rematchRemote=false;this.advancing=true;
    this.time.removeAllEvents();
    this.cancelSplash?.();
    this.cancelSplash = undefined;
    getNav(this).engage();
    this.over = true;
    this.waiting.setVisible(false);
    this.add
      .text(VIEW.cx, VIEW.cy, forfeited?'VICTORY · OPPONENT FORFEITED':'VICTORY · OPPONENT DISCONNECTED', {
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

  private async leave(): Promise<void> {
    this.cancelSplash?.();
    this.cancelSplash = undefined;
    if(!this.over || this.nextSeries)await this.match.session.forfeit(this.match.round);
    this.match.session.leave();
    if (this.match.restoreTune) restoreTune(this.match.restoreTune);
    startScreen(this, 'Menu');
  }
}
