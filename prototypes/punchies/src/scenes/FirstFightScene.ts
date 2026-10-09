import Phaser from 'phaser';
import { t } from '../i18n';
import { track } from '../portal/analytics';
import { loadingFinished } from '../portal/index';
import { setGameplay } from '../portal/gameplay';
import { applyCameraPixelRatio, PIXEL_RATIO, VIEW } from '../render/pixelRatio';
import { fighterGroups, whenGroupsReady } from '../render/art';
import { addVersionStamp } from '../version/versionStamp';
import { FightStage, makeButton } from './FightStage';
import { startScreen } from '../ui/presentation';
import { titleButton } from '../ui/titleButton';
import { RewardReveal } from '../ui/rewardReveal';
import { charName, maxHealth } from '../sim/character';
import { createSimState, step } from '../sim/sim';
import { TICK_RATE, tune } from '../sim/tune';
import { NEUTRAL_INPUT, type FrameInput, type SimState } from '../sim/types';
import { grantFirstGift, loadShopDraft, saveShopDraft } from '../shop/draft';
import { markFirstRunDone } from '../firstrun/state';
import cfg from '../firstrun/firstfight.json';

// First launch only: a gentle bout for new players. Marco against Bruno, best of
// one, jab and cross only, and the player cannot lose. It ends with the
// "Welcome to the Ring" gift and then the main menu. Skippable at any time.

const STEP_MS = 1000 / TICK_RATE;
const MAX_STEPS_PER_FRAME = 5;
type Phase = 'move' | 'jab' | 'cross' | 'mix';

export class FirstFightScene extends Phaser.Scene {
  private sim!: SimState;
  private stage!: FightStage;
  private acc = 0;
  private built = false;
  private ending = false;
  private hits = 0;
  private stepJabs = 0;
  private stepCrosses = 0;
  private phase: Phase = 'move';
  private cooldown = 90;
  private lastPunchAt = 0;
  private coach!: Phaser.GameObjects.Text;

  constructor() {
    super('FirstFight');
  }

  create(): void {
    loadingFinished();
    applyCameraPixelRatio(this);
    this.built = false;
    this.ending = false;
    whenGroupsReady(this, fighterGroups(['marco', 'bruno']), () => this.build());
  }

  private build(): void {
    this.built = true;
    this.acc = 0;
    this.hits = 0;
    this.stepJabs = 0;
    this.stepCrosses = 0;
    this.phase = 'move';
    this.cooldown = 90;
    this.lastPunchAt = this.time.now;
    this.sim = createSimState({ timed: false, fighters: [{ char: 'marco', infiniteStamina: true }, { char: 'bruno', infiniteStamina: true }] });
    this.stage = new FightStage(this, [t('common.you'), charName('bruno')], 0);
    this.stage.hideInfoButton();
    // Only what a newcomer needs: the stick, jab, cross and the health bars.
    this.stage.reveal(new Set(['stick', 'jab', 'cross', 'health']));
    makeButton(this, VIEW.cx, VIEW.top + 46, 64, t('firstfight.skip'), () => this.finish('skip'));

    const panelY = tune.ring.top + 30;
    this.add.rectangle(VIEW.cx, panelY, 540, 44, 0x000000, 0.72).setStrokeStyle(1, 0x5a6378).setDepth(140);
    this.coach = this.add
      .text(VIEW.cx, panelY, '', { fontFamily: 'Arial', fontSize: '13px', fontStyle: 'bold', color: '#ffffff', align: 'center', wordWrap: { width: 520 }, resolution: PIXEL_RATIO })
      .setOrigin(0.5)
      .setDepth(141);
    addVersionStamp(this);
    track('firstrun', 'fight', 'start');
  }

  // Bruno walks up and throws a slow jab now and then. He never blocks or dodges.
  private opponentInput(): FrameInput {
    const [me, d] = this.sim.fighters;
    const dx = me.x - d.x;
    const dy = me.y - d.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (this.cooldown > 0) this.cooldown--;
    if (dist > cfg.opponentJabRange) {
      const k = cfg.opponentApproachSpeed;
      return { ...NEUTRAL_INPUT, mx: Math.round((dx / dist) * 100 * k), my: Math.round((dy / dist) * 100 * k) };
    }
    if (this.cooldown === 0 && !d.punch && !d.dodge) {
      this.cooldown = cfg.opponentJabCooldownTicks;
      return { ...NEUTRAL_INPUT, jab: true };
    }
    return NEUTRAL_INPUT;
  }

  // The player gets move, jab and cross only, from any device.
  private playerInput(): FrameInput {
    const i = this.stage.sampleLocal();
    return { ...i, hook: false, uppercut: false, dodge: false, guard: false };
  }

  private coachText(): string {
    if (this.phase === 'jab') return t('firstfight.coach_jab');
    if (this.phase === 'cross') return t('firstfight.coach_cross');
    if (this.phase === 'mix') return t('firstfight.coach_mix');
    return t('firstfight.coach_move');
  }

  private onHit(punch: string): void {
    this.hits++;
    track('firstrun', punch, 'hit');
    if (this.phase === 'move') this.phase = 'jab';
    if (this.phase === 'jab' && punch === 'jab' && ++this.stepJabs >= cfg.jabsStep) this.phase = 'cross';
    else if (this.phase === 'cross' && punch === 'cross' && ++this.stepCrosses >= cfg.crossesStep) this.phase = 'mix';
    // Each landed hit drains an even share of Bruno's health, so the fight ends after hitsToKo hits.
    const d = this.sim.fighters[1];
    d.health = Math.min(d.health, Math.max(0, maxHealth(d) * (1 - this.hits / cfg.hitsToKo)));
  }

  update(time: number, delta: number): void {
    if (!this.built) return;
    this.stage.pollDevices();
    this.coach.setText(this.coachText() + (time - this.lastPunchAt > cfg.idleHintMs && this.phase !== 'mix' && this.phase !== 'move' ? '\n' + t('firstfight.coach_move') : ''));
    if (!this.ending) {
      this.acc = Math.min(this.acc + delta, STEP_MS * MAX_STEPS_PER_FRAME);
      while (this.acc >= STEP_MS) {
        this.acc -= STEP_MS;
        const input = this.playerInput();
        if (input.jab || input.cross) this.lastPunchAt = time;
        const events = step(this.sim, [input, this.opponentInput()]);
        this.stage.handleEvents(events, this.sim);
        for (const e of events) if (e.kind === 'hit' && e.attacker === 0) this.onHit(e.punch);
        // The newcomer cannot lose: Bruno's jabs never take more than half of Marco's health.
        const me = this.sim.fighters[0];
        if (me.health < maxHealth(me) * cfg.playerHealthFloor) me.health = maxHealth(me);
        if (this.sim.result && this.sim.result.winner !== 0) this.sim.result = null;
      }
      if (this.sim.result && this.stage.koFinished(this.sim, time)) this.finish('win');
    }
    this.stage.draw(this.sim, time);
  }

  private finish(how: 'win' | 'skip'): void {
    if (this.ending) return;
    this.ending = true;
    setGameplay(false);
    track('firstrun', how, 'done');
    markFirstRunDone();
    const gift = grantFirstGift(loadShopDraft());
    saveShopDraft(gift.state);
    if (gift.item) new RewardReveal(this, gift.item, () => this.welcome());
    else this.welcome();
  }

  private welcome(): void {
    const D = 700;
    this.add.rectangle(VIEW.cx, VIEW.cy, VIEW.width, VIEW.height, 0x030711, 0.97).setDepth(D).setInteractive();
    this.add.text(VIEW.cx, VIEW.cy - 50, t('firstfight.welcome_title'), { fontFamily: 'Arial', fontSize: '34px', fontStyle: 'bold', color: '#ffd24a', stroke: '#071024', strokeThickness: 6, resolution: PIXEL_RATIO }).setOrigin(0.5).setDepth(D + 1);
    this.add.text(VIEW.cx, VIEW.cy, t('firstfight.welcome_body'), { fontFamily: 'Arial', fontSize: '15px', color: '#e6eefc', align: 'center', wordWrap: { width: 520 }, resolution: PIXEL_RATIO }).setOrigin(0.5).setDepth(D + 1);
    titleButton(this, VIEW.cx, VIEW.cy + 62, 240, 44, t('firstfight.enter_ring'), () => startScreen(this, 'Menu'), false, D + 1, 'green');
  }
}
