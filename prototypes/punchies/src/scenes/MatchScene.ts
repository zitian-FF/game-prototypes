import {ITCH_BETA_EDITION} from '../edition';
import {STAGING_BUILD,DEBUG_TOOLS_BUILD} from '../buildFlags';
import {newBetaCompletionId,recordBetaCompletion} from '../progress/beta';
import {betaLineupAllowed} from '../editions/beta/policy';
import {ratingStatus,reportRating,ratingConfigured} from '../net/rating';
import {rankedPlayers,rankedResultBinding} from '../net/rankedResult';
import {ratingLabel,ratingStatusText} from '../ui/ratingPresentation';
import { sideProfiles } from '../progress/profile';
import {loadControlModes} from '../input/controlPreferences';
import { startScreen } from '../ui/presentation';
import { t } from '../i18n';
import { track } from '../portal/analytics';
import { setGameplay } from '../portal/gameplay';
import { awardMatch,progressView } from '../progress/progress';
import Phaser from 'phaser';
import { applyCameraPixelRatio, PIXEL_RATIO, VIEW } from '../render/pixelRatio';
import { addVersionStamp } from '../version/versionStamp';
import { FightStage, makeButton } from './FightStage';
import { getNav } from '../ui/menuNav';
import { fighterGroups, prefetchGroups } from '../render/art';
import { Rollback } from '../net/rollback';
import type { MatchData } from './LobbyScene';
import { charName,isCharId } from '../sim/character';
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
  private ratingMatchPromise:Promise<string|null>|undefined;
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
  private stageReady=false;private terminal=false;private connectionEpoch=0;private leaving:Promise<void>|undefined;
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
    const epoch=++this.connectionEpoch;this.stageReady=false;this.terminal=false;this.over=true;this.leaving=undefined;
    applyCameraPixelRatio(this);
    if(ITCH_BETA_EDITION&&(!data.chars.every(isCharId)||(data.skins??['default','default']).some(skin=>skin!=='default'))){data.session.leave();startScreen(this,'Menu',{message:t('online.rules_mismatch')});return;}
    this.match = ITCH_BETA_EDITION?{...data,betaCompletionId:data.series?(data.betaCompletionId??newBetaCompletionId()):data.round===1&&data.session.assignment?.nonce?'online:'+data.session.assignment.nonce:newBetaCompletionId()}:data;
    this.ratingMatchPromise=data.session.ratingMatch;
    const session=data.session,alive=()=>epoch===this.connectionEpoch&&!this.terminal;
    const rejected:typeof session.onRejected=reason=>{if(reason==='incompatible'&&alive()){this.terminal=true;this.over=true;setGameplay(false);session.leave();if(data.restoreTune)restoreTune(data.restoreTune);startScreen(this,'Menu',{message:t('online.rules_mismatch')});}};
    let inputs:typeof session.onInputs|undefined,hash:typeof session.onHash|undefined,ctl:typeof session.onCtl|undefined,peerLeft:typeof session.onPeerLeft|undefined;
    session.onRejected=rejected;
    this.events.once('shutdown',()=>{if(epoch!==this.connectionEpoch)return;this.stageReady=false;this.terminal=true;this.cancelSplash?.();this.cancelSplash=undefined;
      if(session.onRejected===rejected)session.onRejected=()=>{};if(session.onInputs===inputs)session.onInputs=()=>{};if(session.onHash===hash)session.onHash=()=>{};if(session.onCtl===ctl)session.onCtl=()=>{};if(session.onPeerLeft===peerLeft)session.onPeerLeft=()=>{};});
    if(session.markMatchStarted&&!session.markMatchStarted()){rejected('incompatible');return;}
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
      { tapExtra: this.enhanced ? data.delay - this.baseDelay : 0, showcase: this.series.roundNumber === 1,controlModes:data.session.controlModes },
    );
    const rollback=this.ls;
    s.onInputs = inputs = (p) => {if(alive())rollback.receiveInputs(p);};
    s.onHash = hash = (p) => {if(alive())rollback.receiveHash(p);};
    s.onCtl = ctl = (m) => {
      if(!alive())return;
      if(m.k==='forfeit' && m.round===data.round){this.opponentLeft(true);return;}
      if (m.k === 'ping') s.send({ k: 'pong', t: m.t });
      if (m.k === 'pong') this.rtt = this.rtt > 0 ? this.rtt * 0.8 + (performance.now() - m.t) * 0.2 : performance.now() - m.t;
      if (m.k === 'reselect' && m.round === data.round) { this.remoteReselect = true; this.changeBoxer(); }
      if (m.k === 'rematch' && m.round === data.round + 1) {
        this.rematchRemote = true;
        this.tryRematch();
      }
    };
    s.onPeerLeft = peerLeft = () => {if(alive())this.opponentLeft();};
    s.flushRoundTraffic?.();

    const nm = (i: 0 | 1) => charName(data.chars[i]);
    const names: [string, string] =
      data.localIdx === 0 ? [t('match.you_host', { name: nm(0) }), t('match.opponent_name', { name: nm(1) })] : [t('match.opponent_name', { name: nm(0) }), t('match.you_name', { name: nm(1) })];
    // No waiting here: the session is live, so a late atlas just pops in.
    prefetchGroups(fighterGroups(data.chars));
    const profiles=sideProfiles(data.localIdx,data.session.peer);
    this.stage = new FightStage(this, names, data.localIdx,true,data.skins,profiles,
      data.session.rated?rankedPlayers(profiles,data.localIdx,ratingConfigured(),data.session.assignment?.baseline):undefined,data.session.controlModes);
    this.stage.setSeries(this.series);

    const onMenuReturn=()=>this.leave();this.events.on('menuReturn',onMenuReturn);
    this.events.once('shutdown',()=>this.events.off('menuReturn',onMenuReturn));

    this.waiting = this.add
      .text(VIEW.cx, tune.ring.top + 16, t('match.waiting_for_opponent'), {
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
    this.stageReady=true;
  }

  update(time: number, delta: number): void {
    if(!this.stageReady||this.terminal)return;
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
    setGameplay(false);
    this.over = true;
    this.match.session.markRoundEnded?.();
    this.waiting.setVisible(false);
    const r = this.ls.confirmedResult()!;
    const outcome = finishRound(this.series, r.winner);
    this.stage.setSeries(outcome.series);
    if (!outcome.complete) {
      this.nextSeries = outcome.series;
      this.rematchLocal = true;
      const ready = () => {if(!this.terminal){this.ls.flushInputs();this.match.session.send({ k: 'rematch', round: this.match.round + 1 });}};
      ready();
      this.time.addEvent({ delay: 500, loop: true, callback: ready });
      this.tryRematch();
      return;
    }
    if(ITCH_BETA_EDITION&&!this.terminal&&!this.departed)recordBetaCompletion({id:this.match.betaCompletionId!,mode:'online',completed:true,seriesComplete:true,forfeit:false,disconnected:false,qa:STAGING_BUILD||DEBUG_TOOLS_BUILD,win:r.winner===this.match.localIdx});
    this.match.session.markMatchCompleted?.();
    const score=r.winner===null?.5:r.winner===this.match.localIdx?1:0;
    if(!this.match.session.rated)void this.showRating(score);
    const text = r.winner === null ? t('common.draw') : r.winner === this.match.localIdx ? t('common.victory') : t('common.defeat');
    track('match', 'Online', r.winner === null ? 'draw' : r.winner === this.match.localIdx ? 'win' : 'lose');
    this.registry.set('lastAward', awardMatch({ kind: 'online', win: r.winner === this.match.localIdx }));
    if (this.remoteReselect) { void this.showRating(score);this.changeBoxer(); return; }
    const rating=this.match.session.rated?rankedResultBinding({
      players:rankedPlayers(sideProfiles(this.match.localIdx,this.match.session.peer),this.match.localIdx,ratingConfigured(),this.match.session.assignment?.baseline),
      localIdx:this.match.localIdx,configured:ratingConfigured(),match:this.ratingMatchPromise??this.match.session.ratingMatch,
      report:id=>reportRating(id,score),status:ratingStatus,
      schedule:callback=>{const timer=this.time.delayedCall(2000,callback);return ()=>timer.remove();},
    }):undefined;
    if(rating)this.events.once('shutdown',()=>rating.dispose());
    const rem = matchResult(this, text, {
      rematch: () => {
        if (this.rematchLocal||this.terminal||this.departed) return;
        this.match.session.prepareNextMatchMode(loadControlModes()[0],this.match.round+1);
        this.rematchLocal = true;
        rem.setText(t('match.waiting'));
        this.match.session.send({ k: 'rematch', round: this.match.round + 1 });
        this.tryRematch();
      },
      changeBoxer: () => {
        this.match.session.send({ k: 'reselect', round: this.match.round });
        this.changeBoxer();
      },
      menu: () => this.leave(),
    }, outcome.series.wins, r.winner===null?undefined:{char:this.match.chars[r.winner],skin:this.match.skins?.[r.winner],title:r.winner===this.match.localIdx?progressView().title:this.match.session.peer.title}, r.winner===null?'draw':r.winner===this.match.localIdx?'victory':'defeat',
      rating?{players:rating.players,localIdx:this.match.localIdx,subscribe:update=>rating.subscribe(update),nextMatch:()=>{rating.dispose();this.findNextMatch();}}:undefined);
  }

  private findNextMatch():void {
    if(!this.match.session.rated||!this.over||this.nextSeries||this.advancing)return;
    this.advancing=true;this.departed=true;this.terminal=true;
    this.cancelSplash?.();this.cancelSplash=undefined;
    this.match.session.leave();
    if(this.match.restoreTune)restoreTune(this.match.restoreTune);
    startScreen(this,'Lobby',{role:'host',rated:true});
  }

  private async showRating(score?:0|.5|1):Promise<void>{
    if(!this.match.session.rated)return;
    const status=ratingStatusText(this,VIEW.cx,VIEW.top+24,Math.min(560,VIEW.width-80),155);
    const label=status.label;
    status.set(ratingLabel({phase:'pending'},t));
    const matchPromise=this.ratingMatchPromise??this.match.session.ratingMatch;
    const id=await matchPromise;if(!id){if(this.scene.isActive())status.set(ratingLabel({phase:'unavailable'},t));return;}
    let result=score===undefined?await ratingStatus(id):await reportRating(id,score);if(!this.scene.isActive())return;
    const alive=()=>this.scene.isActive()&&label.active;
    const refresh=()=>{if(!alive())return;status.set(ratingLabel(result?.state==='settled'
      ?{phase:'settled',rating:result.rating,delta:result.delta}
      :{phase:!result?'unavailable':result.state==='expired'?'expired':'pending'},t));};refresh();
    if(result?.state!=='settled'&&result?.state!=='expired'){
      let busy=false;
      const poll=this.time.addEvent({delay:2000,repeat:299,callback:()=>{
        if(!alive()){poll.remove();return;}if(busy)return;busy=true;
        void ratingStatus(id).then(next=>{result=next;refresh();if(next?.state==='settled'||next?.state==='expired')poll.remove();}).finally(()=>busy=false);
      }});
      this.events.once('shutdown',()=>poll.remove());
    }
  }
  private tryRematch(): void {
    if (this.terminal||this.departed||!this.over || !this.rematchLocal || !this.rematchRemote || this.advancing) return;
    this.advancing = true;
    if(this.match.session.rated&&!this.nextSeries&&this.match.localIdx===0){const nonce=crypto.randomUUID();this.match.session.send({k:'ratingSet',nonce});void this.match.session.beginRating(nonce);}
    const epoch=this.connectionEpoch,next={...this.match,round:this.match.round+1,series:this.nextSeries};
    this.cancelSplash = roundSplash(this, () => {if(epoch===this.connectionEpoch&&!this.terminal&&!this.departed&&this.match.session.readyForMatch!==false)this.scene.restart(next);});
  }

  private changeBoxer(): void {
    if (this.terminal||this.departed||this.advancing || !this.over || this.nextSeries) return;
    this.advancing = true;this.terminal=true;
    this.match.session.prepareNextMatchMode(loadControlModes()[0],this.match.round+1);
    startScreen(this, 'CharSelect', { mode: 'online', session: this.match.session,
      localIdx: this.match.localIdx, delay: this.match.delay, restoreTune: this.match.restoreTune,
      nextRound: this.match.round + 1 });
  }

  private opponentLeft(forfeited=false): void {
    if(this.departed)return;
    this.departed=true;this.terminal=true;this.rematchLocal=false;this.rematchRemote=false;this.advancing=true;setGameplay(false);
    this.time.removeAllEvents();
    if(!this.over||this.nextSeries)void this.showRating(forfeited?1:undefined);
    // A remote disappearance is not a voluntary local quit, including Bo3 breaks.
    this.nextSeries=undefined;
    this.cancelSplash?.();
    this.cancelSplash = undefined;
    getNav(this).engage();
    this.over = true;
    if(!this.stageReady){startScreen(this,'Menu',{message:forfeited?t('match.victory_opponent_forfeited'):t('match.victory_opponent_disconnected')});return;}
    this.waiting.setVisible(false);
    this.add
      .text(VIEW.cx, VIEW.cy, forfeited?t('match.victory_opponent_forfeited'):t('match.victory_opponent_disconnected'), {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#ffffff',
        backgroundColor: '#000000cc',
        padding: { x: 10, y: 6 },
        resolution: PIXEL_RATIO,
      })
      .setOrigin(0.5)
      .setDepth(150);
    makeButton(this, VIEW.cx, VIEW.cy + 50, 100, t('common.menu'), () => this.leave(), 26, 10, 0xdb4c66);
  }

  private async leave(): Promise<void> {
    if(this.leaving)return this.leaving;
    const forfeit=!this.departed&&(!this.over||!!this.nextSeries);this.terminal=true;setGameplay(false);
    this.cancelSplash?.();
    this.cancelSplash = undefined;
    this.leaving=(async()=>{if(forfeit)await this.match.session.forfeit(this.match.round);this.match.session.leave();if(this.match.restoreTune)restoreTune(this.match.restoreTune);startScreen(this, 'Menu');})();
    return this.leaving;
  }
}
