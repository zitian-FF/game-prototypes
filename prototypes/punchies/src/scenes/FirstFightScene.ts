import { portraitScaleFactor } from '../render/portraitScale';
import { bindingLabel } from '../ui/inputGlyph';
import { devices } from '../input/devices';
import Phaser from 'phaser';
import { availableLanguages, t } from '../i18n';
import { chooseLanguage } from '../i18n/init';
import { store } from '../portal/store';
import { KEYS } from '../portal/keys';
import { track } from '../portal/analytics';
import { loadingFinished } from '../portal/index';
import { setGameplay } from '../portal/gameplay';
import { applyCameraPixelRatio, PIXEL_RATIO, VIEW } from '../render/pixelRatio';
import { artImage, artKey, fighterGroups, whenGroupsReady } from '../render/art';
import { portraitBounds } from '../render/portraitBounds';
import { addVersionStamp } from '../version/versionStamp';
import { FightStage, makeButton } from './FightStage';
import { startScreen } from '../ui/presentation';
import { titleButton } from '../ui/titleButton';
import { cartoonPanel } from '../ui/cartoonChrome';
import { RewardReveal } from '../ui/rewardReveal';
import { charName, maxHealth } from '../sim/character';
import { createSimState, step } from '../sim/sim';
import { TICK_RATE, tune } from '../sim/tune';
import { NEUTRAL_INPUT, type FrameInput, type SimState } from '../sim/types';
import { grantFirstGift, loadShopDraft, saveShopDraft } from '../shop/draft';
import { awardMatch } from '../progress/progress';
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
    this.registry.set('firstFightComplete', false);
    this.events.on('menuReturn', this.skipFromMenu, this);
    this.events.once('shutdown', () => {
      this.events.off('menuReturn', this.skipFromMenu, this);
      this.registry.remove('firstFightComplete');
    });
    whenGroupsReady(this, fighterGroups(['marco', 'bruno']), () => this.chooseFirstLanguage());
  }

  private chooseFirstLanguage(): void {
    const languages = availableLanguages();
    if (languages.length < 2 || store.getItem(KEYS.language)) { this.build(); return; }
    const panel = this.add.container().setDepth(500);
    panel.add(this.add.rectangle(VIEW.cx, VIEW.cy, VIEW.width, VIEW.height, 0x071020).setInteractive());
    const logo = artImage(this, 'logo', VIEW.cx, VIEW.cy - 114, 280, 80);
    if (logo) panel.add(logo);
    panel.add(this.add.text(VIEW.cx, VIEW.cy - 46, t('menu.language'), {fontFamily:'Arial',fontSize:22,fontStyle:'bold',color:'#fff3da',resolution:PIXEL_RATIO}).setOrigin(.5));
    let choosing = false;
    const buttons: Phaser.GameObjects.Text[] = [];
    languages.forEach((language, i) => {
      const button = titleButton(this, VIEW.cx + (i % 2 ? 90 : -90), VIEW.cy + 6 + Math.floor(i / 2) * 46, 166, 36, language.native, () => {
        if (choosing) return;
        choosing = true;
        void chooseLanguage(language.code).then(() => {
          panel.destroy(true);
          buttons.forEach(label => { label.getData('bg').destroy(); label.destroy(); });
          this.build();
        }).catch(() => { choosing = false; });
      }, false, 501, 'blue');
      // Keep the label above titleButton's independently drawn graphics.
      buttons.push(button);
    });
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
    makeButton(this, VIEW.right - 52, VIEW.top + 24, 76, t('firstfight.skip'), () => this.finish('skip'));

    const panelY = tune.ring.top + 30;
    const coachPanel = this.add.graphics().setDepth(140);
    coachPanel.fillStyle(0x10243b, .92).fillRoundedRect(VIEW.cx - 270, panelY - 22, 540, 44, 9);
    coachPanel.fillStyle(0xffd24a).fillRoundedRect(VIEW.cx - 270, panelY - 22, 5, 44, 2);
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

  private skipFromMenu(): void {
    this.scene.resume();
    this.finish('skip');
  }

  private coachText(): string {
    const source = devices.lastSource === 'touch' ? 'kb1' : devices.lastSource;
    const binding = (action: 'jab' | 'cross') => devices.lastDevice === 'touch' ? action === 'jab' ? t('common.jab') : t('common.cross') : bindingLabel(source, action);
    if (this.phase === 'jab') return t('layouts.coach_jab', { binding: binding('jab') });
    if (this.phase === 'cross') return t('layouts.coach_cross', { binding: binding('cross') });
    if (this.phase === 'mix') return t('firstfight.coach_mix');
    return t('layouts.coach_move', { binding: devices.lastDevice === 'touch' ? t('tutorial.the_joystick_left_side') : devices.lastDevice === 'gamepad' ? t('tutorial.the_left_stick') : ['up', 'left', 'down', 'right'].map(a => bindingLabel(source, a as 'up' | 'left' | 'down' | 'right')).join(' / ') });
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
    const [player, opponent] = this.sim.fighters;
    if (this.phase === 'move' && Math.hypot(player.x - opponent.x, player.y - opponent.y) <= cfg.opponentJabRange) this.phase = 'jab';
    this.coach.setText(this.coachText() + (time - this.lastPunchAt > cfg.idleHintMs && this.phase !== 'mix' && this.phase !== 'move' ? '\n' + t('layouts.coach_close') : ''));
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
    this.registry.set('firstFightComplete', true);
    setGameplay(false);
    track('firstrun', how, 'done');
    markFirstRunDone();
    if (how === 'win') this.registry.set('lastAward', awardMatch({ kind: 'firstfight', win: true }));
    const gift = grantFirstGift(loadShopDraft());
    saveShopDraft(gift.state);
    if (gift.item) new RewardReveal(this, gift.item, () => this.welcome());
    else this.welcome();
  }

  private welcome(): void {
    const D = 700;
    this.coach.setVisible(false);
    this.add.rectangle(VIEW.cx, VIEW.cy, VIEW.width, VIEW.height, 0x071020, .94).setDepth(D).setInteractive();
    const key = artKey(this, 'portrait_marco_rising_star') ?? artKey(this, 'portrait_marco');
    if (key) {
      const portrait = this.add.image(VIEW.cx - 235, VIEW.bottom, key).setOrigin(.5, 1).setDepth(D + 1);
      const source = this.textures.get(key).getSourceImage() as HTMLImageElement;
      const bounds = portraitBounds(this, key);
      portrait.setOrigin((bounds.left + bounds.right) / 2 / source.width, bounds.bottom / source.height);
      portrait.setScale(Math.min(VIEW.height * .92 / (bounds.bottom - bounds.top), 330 / (bounds.right - bounds.left))*portraitScaleFactor('marco'));
    }
    const x = VIEW.cx + 125;
    const graphics = this.add.graphics().setDepth(D + 2);
    cartoonPanel(graphics, x - 190, VIEW.cy - 145, 380, 290, 0x244368, 14);
    this.add.text(x, VIEW.cy - 115, t('firstfight.welcome_title'), { fontFamily: 'Arial', fontSize: '25px', fontStyle: 'bold', color: '#ffd24a', stroke: '#071024', strokeThickness: 3, padding:{left:8,right:8}, resolution: PIXEL_RATIO }).setOrigin(0.5).setDepth(D + 3);
    artImage(this, 'chest_skin_base', x, VIEW.cy - 35, 140, 110, D + 3);
    this.add.text(x, VIEW.cy + 37, t('firstfight.welcome_body'), { fontFamily: 'Arial', fontSize: '15px', color: '#e6eefc', align: 'center', wordWrap: { width: 330 }, resolution: PIXEL_RATIO }).setOrigin(0.5).setDepth(D + 3);
    titleButton(this, x, VIEW.cy + 103, 260, 42, t('firstfight.enter_ring'), () => startScreen(this, 'Menu'), false, D + 3, 'green');
  }
}
