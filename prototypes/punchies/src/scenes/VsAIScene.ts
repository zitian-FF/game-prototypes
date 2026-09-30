import Phaser from 'phaser';
import { applyCameraPixelRatio, PIXEL_RATIO, VIEW } from '../render/pixelRatio';
import { addVersionStamp } from '../version/versionStamp';
import { FightStage, makeButton } from './FightStage';
import { createSimState, step } from '../sim/sim';
import { EasyAI } from '../sim/ai';
import { TICK_RATE } from '../sim/tune';
import type { SimState } from '../sim/types';

// Single player: a full timed round against the easy AI.

const STEP_MS = 1000 / TICK_RATE;
const MAX_STEPS_PER_FRAME = 5;

export class VsAIScene extends Phaser.Scene {
  private sim!: SimState;
  private stage!: FightStage;
  private ai!: EasyAI;
  private acc = 0;
  private over = false;

  constructor() {
    super('VsAI');
  }

  create(): void {
    applyCameraPixelRatio(this);
    this.acc = 0;
    this.over = false;
    this.sim = createSimState({ timed: true, fighters: [{}, {}] });
    this.ai = new EasyAI(1);
    this.stage = new FightStage(this, ['YOU', 'CPU (easy)'], 0);
    makeButton(this, VIEW.cx + 70, VIEW.top + 46, 56, 'MENU', () => this.scene.start('Menu'));
    addVersionStamp(this);
  }

  update(time: number, delta: number): void {
    this.stage.pollDevices();
    if (!this.over) {
      this.acc = Math.min(this.acc + delta, STEP_MS * MAX_STEPS_PER_FRAME);
      while (this.acc >= STEP_MS) {
        this.acc -= STEP_MS;
        const events = step(this.sim, [this.stage.sampleLocal(), this.ai.think(this.sim)]);
        this.stage.handleEvents(events, this.sim);
      }
      if (this.sim.result && this.stage.koFinished(this.sim, time)) this.showResult();
    }
    this.stage.draw(this.sim, time);
  }

  private showResult(): void {
    this.over = true;
    const r = this.sim.result!;
    const text = r.winner === null ? 'DRAW' : r.winner === 0 ? 'YOU WIN' : 'YOU LOSE';
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
    makeButton(this, VIEW.cx - 60, VIEW.cy + 100, 100, 'REMATCH', () => this.scene.restart());
    makeButton(this, VIEW.cx + 60, VIEW.cy + 100, 100, 'MENU', () => this.scene.start('Menu'));
  }
}
