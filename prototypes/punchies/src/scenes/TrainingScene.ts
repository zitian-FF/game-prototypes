import { startScreen } from '../ui/presentation';
import Phaser from 'phaser';
import { applyCameraPixelRatio, VIEW } from '../render/pixelRatio';
import { addVersionStamp } from '../version/versionStamp';
import { FightStage } from './FightStage';
import { CHARACTER_IDS, charName, type CharId } from '../sim/character';
import { prefetchGroups, trainingGroups, whenGroupsReady } from '../render/art';
import { loadCharPrefs, saveCharPrefs } from '../sim/charPrefs';
import { createSimState, step } from '../sim/sim';
import { tune, TICK_RATE } from '../sim/tune';
import { NEUTRAL_INPUT, type FrameInput, type SimState } from '../sim/types';

// Solo training: player vs a static dummy. The dummy's stance cycles between
// Normal, High Guard and Vulnerable. Its HP never refills until RESET.

const STEP_MS = 1000 / TICK_RATE;
const MAX_STEPS_PER_FRAME = 5;

const DUMMY_STANCES = ['NORMAL', 'HIGH GUARD', 'VULNERABLE'] as const;
type DummyStance = (typeof DUMMY_STANCES)[number];

export class TrainingScene extends Phaser.Scene {
  private sim!: SimState;
  private stage!: FightStage;
  private acc = 0;
  private dummyStance: DummyStance = 'NORMAL';
  private stanceLabel!: Phaser.GameObjects.Text;
  private charLabel!: Phaser.GameObjects.Text;
  private char: CharId = 'marco';

  constructor() {
    super('Training');
  }

  create(): void {
    applyCameraPixelRatio(this);
    this.built = false;
    this.char = loadCharPrefs().p1;
    whenGroupsReady(this, trainingGroups(this.char), () => this.build());
  }

  private built = false;

  private build(): void {
    this.built = true;
    this.acc = 0;
    this.newSim();
    this.stage = new FightStage(this, ['YOU', 'DUMMY'], 0);
    this.charLabel = this.stage.button(VIEW.left + 105, VIEW.top + 110, 110, '', () => this.cycleChar());
    this.stanceLabel = this.stage.button(VIEW.left + 105, VIEW.top + 140, 110, '', () => this.cycleStance());
    this.stage.button(VIEW.left + 105, VIEW.top + 170, 110, 'RESET', () => this.newSim());
    this.refreshStance();
    this.charLabel.setText(`YOU: ${charName(this.char)}`);
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

  // Swap the player's boxer (fresh sim, like RESET). Remembered as the P1 pick.
  private cycleChar(): void {
    this.char = CHARACTER_IDS[(CHARACTER_IDS.indexOf(this.char) + 1) % CHARACTER_IDS.length];
    saveCharPrefs({ p1: this.char });
    prefetchGroups(trainingGroups(this.char)); // the boxer's art pops in once it arrives
    this.charLabel.setText(`YOU: ${charName(this.char)}`);
    this.newSim();
  }

  private cycleStance(): void {
    this.dummyStance = DUMMY_STANCES[(DUMMY_STANCES.indexOf(this.dummyStance) + 1) % DUMMY_STANCES.length];
    this.refreshStance();
  }

  private refreshStance(): void {
    this.stanceLabel.setText(`DUMMY: ${this.dummyStance}`);
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
