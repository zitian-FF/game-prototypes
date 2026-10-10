import { t } from '../i18n';
import Phaser from 'phaser';
import { availableFighters,equippedSkin } from '../shop/roster';
import { loadShopDraft } from '../shop/draft';
import { applyCameraPixelRatio, VIEW } from '../render/pixelRatio';
import { addVersionStamp } from '../version/versionStamp';
import { FightStage } from './FightStage';
import { isCharId, type CharId } from '../sim/character';
import { trainingGroups, whenGroupsReady } from '../render/art';
import { loadCharPrefs } from '../sim/charPrefs';
import { createSimState, step } from '../sim/sim';
import { tune, TICK_RATE } from '../sim/tune';
import { NEUTRAL_INPUT, type FrameInput, type SimState } from '../sim/types';

// Solo training: player vs a static dummy. The dummy's stance cycles between
// Normal, High Guard and Vulnerable. Its HP never refills until RESET.

const STEP_MS = 1000 / TICK_RATE;
const MAX_STEPS_PER_FRAME = 5;

const DUMMY_STANCES = ['NORMAL', 'HIGH GUARD', 'VULNERABLE'] as const;
type DummyStance = (typeof DUMMY_STANCES)[number];
const STANCE_KEY: Record<DummyStance, string> = { NORMAL: 'training.stance_normal', 'HIGH GUARD': 'training.stance_high_guard', VULNERABLE: 'training.stance_vulnerable' };

export class TrainingScene extends Phaser.Scene {
  private sim!: SimState;
  private stage!: FightStage;
  private acc = 0;
  private dummyStance: DummyStance = 'NORMAL';
  private stanceLabel!: Phaser.GameObjects.Text;
  private skin = 'default';
  private char: CharId = 'marco';

  constructor() {
    super('Training');
  }

  create(data: {char?:CharId;skin?:string} = {}): void {
    applyCameraPixelRatio(this);
    this.built = false;
    const preferred=isCharId(data.char)?data.char:loadCharPrefs().p1;
    this.char=availableFighters(loadShopDraft()).includes(preferred)?preferred:'marco';
    this.skin=equippedSkin(loadShopDraft(),this.char,data.skin??loadCharPrefs().skins.p1?.[this.char]);
    whenGroupsReady(this, trainingGroups(this.char), () => this.build());
  }

  private built = false;

  private build(): void {
    this.built = true;
    this.acc = 0;
    this.newSim();
    this.stage = new FightStage(this, [t('common.you'), t('common.dummy')], 0,true,[this.skin,'default']);
    this.stanceLabel = this.stage.button(VIEW.left + 105, VIEW.top + 110, 110, '', () => this.cycleStance());
    this.stage.button(VIEW.left + 105, VIEW.top + 140, 110, t('training.reset'), () => this.newSim());
    this.refreshStance();
    addVersionStamp(this);
  }

  private newSim(): void {
    this.sim = createSimState({
      timed: false,
      fighters: [{ char: this.char }, { anchored: true, infiniteStamina: tune.training.dummyInfiniteStamina }],
    });
    this.sim.fighters[1].x=(tune.ring.left+tune.ring.right)/2;
    this.sim.fighters[1].y=(tune.ring.top+tune.ring.bottom)/2;
    this.applyStance();
  }

  private cycleStance(): void {
    this.dummyStance = DUMMY_STANCES[(DUMMY_STANCES.indexOf(this.dummyStance) + 1) % DUMMY_STANCES.length];
    this.refreshStance();
  }

  private refreshStance(): void {
    this.stanceLabel.setText(t('training.dummy_stance', { stance: t(STANCE_KEY[this.dummyStance]) }));
    this.applyStance();
  }

  private applyStance(): void {
    if (this.sim) this.sim.fighters[1].forceVulnerable = this.dummyStance === 'VULNERABLE';
  }

  private dummyInput(): FrameInput {
    return this.dummyStance === 'HIGH GUARD' ? { ...NEUTRAL_INPUT, guard: true } : NEUTRAL_INPUT;
  }

  update(time: number, delta: number): void {
    if (!this.built) return;
    this.stage.pollDevices();
    this.acc = Math.min(this.acc + delta, STEP_MS * MAX_STEPS_PER_FRAME);
    while (this.acc >= STEP_MS) {
      this.acc -= STEP_MS;
      const events = step(this.sim, [this.stage.sampleLocal(), this.dummyInput()], false);
      this.stage.handleEvents(events, this.sim);
    }
    this.stage.draw(this.sim, time);
  }
}
