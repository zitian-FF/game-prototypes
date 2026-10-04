import Phaser from 'phaser';
import { applyCameraPixelRatio, PIXEL_RATIO, VIEW } from '../render/pixelRatio';
import { addVersionStamp } from '../version/versionStamp';
import { FightStage, makeButton } from './FightStage';
import { getNav } from '../ui/menuNav';
import { fighterGroups, resultArt, whenGroupsReady } from '../render/art';
import { charName } from '../sim/character';
import { createSimState, step } from '../sim/sim';
import { makeBot, type Bot, type BotLevel } from '../sim/bot';
import { TICK_RATE } from '../sim/tune';
import type { SimState } from '../sim/types';

// Single player: a full timed round against the easy AI.

const STEP_MS = 1000 / TICK_RATE;
const MAX_STEPS_PER_FRAME = 5;

export class VsAIScene extends Phaser.Scene {
  private sim!: SimState;
  private stage!: FightStage;
  private ai!: Bot;
  private level: BotLevel = 'easy';
  private acc = 0;
  private over = false;

  constructor() {
    super('VsAI');
  }

  private chars: [string, string] = ['marco', 'marco'];

  create(data: { chars?: [string, string]; level?: BotLevel }): void {
    this.chars = data?.chars ?? this.chars;
    this.level = data?.level ?? this.level;
    applyCameraPixelRatio(this);
    this.built = false;
    whenGroupsReady(this, fighterGroups(this.chars), () => this.build());
  }

  private built = false;

  private build(): void {
    this.built = true;
    this.acc = 0;
    this.over = false;
    this.sim = createSimState({ timed: true, fighters: [{ char: this.chars[0] }, { char: this.chars[1] }] });
    this.ai = makeBot(this.level, 1);
    this.stage = new FightStage(this, [`YOU · ${charName(this.chars[0])}`, `CPU (${this.level}) · ${charName(this.chars[1])}`], 0);
    makeButton(this, VIEW.cx + 70, VIEW.top + 46, 56, 'MENU', () => this.scene.start('Menu'));
    addVersionStamp(this);
  }

  update(time: number, delta: number): void {
    if (!this.built) return;
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
    resultArt(this);
    this.over = true;
    getNav(this).engage();
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
    makeButton(this, VIEW.cx - 60, VIEW.cy + 100, 100, 'REMATCH', () => this.scene.restart({ chars: this.chars, level: this.level }));
    makeButton(this, VIEW.cx + 60, VIEW.cy + 100, 100, 'MENU', () => this.scene.start('Menu'));
  }
}
