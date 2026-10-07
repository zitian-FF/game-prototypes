import { startScreen } from '../ui/presentation';
import Phaser from 'phaser';
import { applyCameraPixelRatio, VIEW } from '../render/pixelRatio';
import { addVersionStamp } from '../version/versionStamp';
import { FightStage, makeButton } from './FightStage';
import { newSeries, finishRound, type SeriesState } from '../sim/series';
import { roundSplash, matchResult } from '../ui/matchPresentation';
import { tune } from '../sim/tune';
import { fighterGroups, whenGroupsReady } from '../render/art';
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
  private series!: SeriesState;


  constructor() {
    super('VsAI');
  }

  private chars: [string, string] = ['marco', 'marco'];

  create(data: { chars?: [string, string]; level?: BotLevel; series?: SeriesState }): void {
    this.series = data?.series ?? newSeries(tune.match.bestOf);

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
    makeButton(this, VIEW.cx + 70, VIEW.top + 46, 56, 'MENU', () => startScreen(this, 'Menu'));
    this.stage.setSeries(this.series);

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
    this.over = true;
    this.acc = 0;
    const r = this.sim.result!;
    const outcome = finishRound(this.series, r.winner);
    this.stage.setSeries(outcome.series);
    if (!outcome.complete) {
      roundSplash(this, () => this.scene.restart({ chars: this.chars, level: this.level, series: outcome.series }));
      return;
    }
    matchResult(this, r.winner === null ? 'DRAW' : r.winner === 0 ? 'VICTORY' : 'DEFEAT', {
      rematch: () => this.scene.restart({ chars: this.chars, level: this.level }),
      changeBoxer: () => startScreen(this, 'CharSelect', { mode: 'vsai' }),
      menu: () => startScreen(this, 'Menu'),
    });
  }
}