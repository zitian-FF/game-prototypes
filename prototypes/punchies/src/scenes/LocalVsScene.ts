import Phaser from 'phaser';
import { applyCameraPixelRatio, PIXEL_RATIO, VIEW } from '../render/pixelRatio';
import { addVersionStamp } from '../version/versionStamp';
import { FightStage, makeButton } from './FightStage';
import { createSimState, step } from '../sim/sim';
import { TICK_RATE } from '../sim/tune';
import type { SimState } from '../sim/types';
import { SOURCE_LABEL } from '../input/devices';
import type { LocalInputs } from '../input/localSetup';

// Local VS: two players on one screen, each on their own input device
// (chosen in the menu's input popup). Only P1 can use touch.

const STEP_MS = 1000 / TICK_RATE;
const MAX_STEPS_PER_FRAME = 5;

export class LocalVsScene extends Phaser.Scene {
  private sim!: SimState;
  private stage!: FightStage;
  private inputs!: LocalInputs;
  private acc = 0;
  private over = false;

  constructor() {
    super('LocalVs');
  }

  create(data: LocalInputs): void {
    applyCameraPixelRatio(this);
    this.inputs = data;
    this.acc = 0;
    this.over = false;
    this.sim = createSimState({ timed: true, fighters: [{}, {}] });
    const names: [string, string] = [`P1 · ${SOURCE_LABEL[data.p1]}`, `P2 · ${SOURCE_LABEL[data.p2]}`];
    this.stage = new FightStage(this, names, -1, data.p1 === 'touch');
    this.stage.localVsRows = data.p1 === 'touch' ? [1] : [0, 1];
    makeButton(this, VIEW.cx + 70, VIEW.top + 46, 56, 'MENU', () => this.scene.start('Menu'));
    addVersionStamp(this);
  }

  update(time: number, delta: number): void {
    this.stage.pollDevices();
    if (!this.over) {
      this.acc = Math.min(this.acc + delta, STEP_MS * MAX_STEPS_PER_FRAME);
      while (this.acc >= STEP_MS) {
        this.acc -= STEP_MS;
        const events = step(this.sim, [this.stage.sampleSource(this.inputs.p1), this.stage.sampleSource(this.inputs.p2)]);
        this.stage.handleEvents(events, this.sim);
      }
      if (this.sim.result && this.stage.koFinished(this.sim, time)) this.showResult();
    }
    this.stage.draw(this.sim, time);
  }

  private showResult(): void {
    this.over = true;
    const r = this.sim.result!;
    const text = r.winner === null ? 'DRAW' : `P${r.winner + 1} WINS`;
    const sub = r.reason === 'ko' ? 'by K.O.' : 'on points (health)';
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
      .setDepth(150);
    makeButton(this, VIEW.cx - 60, VIEW.cy + 100, 100, 'REMATCH', () => this.scene.restart(this.inputs));
    makeButton(this, VIEW.cx + 60, VIEW.cy + 100, 100, 'MENU', () => this.scene.start('Menu'));
  }
}
